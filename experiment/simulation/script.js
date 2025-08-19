class ByzantineSimulation {
    constructor() {
        this.canvas = document.getElementById('networkCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.messages = [];
        this.consensusRound = 0;
        this.messageCount = 0;
        this.isRunning = false;
        this.animationId = null;
        this.animationSpeed = 1;
        this.simulationMode = 'manual';
        this.manualStep = 0;
        this.currentPhase = 'idle';
        this.phaseTimer = 0;
        this.stepQueue = [];
        this.currentStepIndex = 0;
        
        this.setupCanvas();
        this.setupEventListeners();
        this.initializeNetwork();
        this.updateControls();
        this.animate();
    }

    updateControls() {
        const manualControls = document.getElementById('manualControls');
        const automaticControls = document.getElementById('automaticControls');
        
        if (this.simulationMode === 'manual') {
            manualControls.style.display = 'block';
            automaticControls.style.display = 'none';
        } else {
            manualControls.style.display = 'none';
            automaticControls.style.display = 'block';
        }
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }

    resizeCanvas() {
        const container = document.querySelector('.simulation-area');
        this.canvas.width = container.clientWidth - 40;
        this.canvas.height = container.clientHeight - 40;
        this.positionNodes();
    }

    setupEventListeners() {
        document.getElementById('nodeCount').addEventListener('input', (e) => {
            document.getElementById('nodeCountValue').textContent = e.target.value;
            this.initializeNetwork();
        });

        document.getElementById('faultyCount').addEventListener('input', (e) => {
            document.getElementById('faultyCountValue').textContent = e.target.value;
            this.initializeNetwork();
        });

        document.getElementById('animationSpeed').addEventListener('input', (e) => {
            this.animationSpeed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = e.target.value + 'x';
        });

        document.getElementById('simulationMode').addEventListener('change', (e) => {
            this.simulationMode = e.target.value;
            this.log(`Simulation mode changed to: ${this.simulationMode}`, 'message');
            this.resetNetwork();
            this.updateControls();
        });

        document.getElementById('nextStepBtn').addEventListener('click', () => {
            this.handleManualStep();
        });

        document.getElementById('startConsensus').addEventListener('click', () => {
            this.startConsensus();
        });

        document.getElementById('resetNetwork').addEventListener('click', () => {
            this.resetNetwork();
        });

        document.getElementById('reassignNodes').addEventListener('click', () => {
            this.reassignNodeRoles();
        });
    }

    initializeNetwork() {
        const nodeCount = parseInt(document.getElementById('nodeCount').value);
        const faultyCount = parseInt(document.getElementById('faultyCount').value);
        
        // Ensure Byzantine fault tolerance: f < n/3
        const maxFaulty = Math.floor((nodeCount - 1) / 3);
        const actualFaulty = Math.min(faultyCount, maxFaulty);
        
        if (actualFaulty !== faultyCount) {
            document.getElementById('faultyCount').value = actualFaulty;
            document.getElementById('faultyCountValue').textContent = actualFaulty;
        }

        this.nodes = [];
        this.messages = [];
        this.consensusRound = 0;
        this.messageCount = 0;
        this.currentPhase = 'idle';
        this.isRunning = false;

        // Create nodes with random initial values
        for (let i = 0; i < nodeCount; i++) {
            this.nodes.push({
                id: i,
                position: { x: 0, y: 0 },
                type: 'honest',
                value: Math.floor(Math.random() * 2),
                proposedValue: null,
                receivedProposals: [],
                pulse: 0
            });
        }

        // Randomly select Byzantine nodes
        if (actualFaulty > 0) {
            const byzantineIndices = this.getRandomIndices(nodeCount, actualFaulty);
            byzantineIndices.forEach(index => {
                this.nodes[index].type = 'byzantine';
            });
            this.log(`Byzantine nodes randomly assigned: ${byzantineIndices.map(i => i).join(', ')}`, 'failure');
        }

        // Randomly select leader from honest nodes
        const honestNodes = this.nodes.filter((node, index) => node.type === 'honest');
        if (honestNodes.length > 0) {
            const randomLeaderIndex = Math.floor(Math.random() * honestNodes.length);
            const leaderNode = honestNodes[randomLeaderIndex];
            leaderNode.type = 'leader';
            this.log(`Leader randomly assigned: Node ${leaderNode.id}`, 'consensus');
        } else {
            this.log('Warning: No honest nodes available for leader selection!', 'failure');
        }

        this.positionNodes();
        this.updateStatus();
        this.updatePhaseIndicator();
        
        // Enhanced logging with node assignments
        const byzantineNodes = this.nodes.filter(n => n.type === 'byzantine').map(n => n.id);
        const leaderNode = this.nodes.find(n => n.type === 'leader');
        const honestNodeIds = this.nodes.filter(n => n.type === 'honest').map(n => n.id);
        
        this.log(`Network initialized: ${nodeCount} nodes total`, 'message');
        this.log(`Byzantine nodes (${byzantineNodes.length}): [${byzantineNodes.join(', ')}]`, 'failure');
        this.log(`Leader node: ${leaderNode ? leaderNode.id : 'None'}`, 'consensus');
        this.log(`Honest nodes (${honestNodeIds.length}): [${honestNodeIds.join(', ')}]`, 'message');
        this.log(`Byzantine fault tolerance: f ≤ ⌊(${nodeCount}-1)/3⌋ = ${Math.floor((nodeCount-1)/3)}`, 'message');
    }

    positionNodes() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(this.canvas.width, this.canvas.height) * 0.3;

        this.nodes.forEach((node, index) => {
            const angle = (index * 2 * Math.PI) / this.nodes.length;
            node.position.x = centerX + radius * Math.cos(angle);
            node.position.y = centerY + radius * Math.sin(angle);
        });
    }

    getRandomIndices(total, count) {
        const indices = [];
        const available = Array.from({ length: total }, (_, i) => i);
        
        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * available.length);
            indices.push(available[randomIndex]);
            available.splice(randomIndex, 1);
        }
        
        return indices.sort((a, b) => a - b);
    }

    reassignNodeRoles() {
        if (this.isRunning) {
            this.log('Cannot reassign nodes during consensus!', 'failure');
            return;
        }

        const faultyCount = parseInt(document.getElementById('faultyCount').value);
        const nodeCount = this.nodes.length;
        const maxFaulty = Math.floor((nodeCount - 1) / 3);
        const actualFaulty = Math.min(faultyCount, maxFaulty);

        // Reset all nodes to honest
        this.nodes.forEach(node => {
            node.type = 'honest';
            node.proposedValue = null;
            node.receivedProposals = [];
            node.pulse = 0;
        });

        // Randomly reassign Byzantine nodes
        if (actualFaulty > 0) {
            const byzantineIndices = this.getRandomIndices(nodeCount, actualFaulty);
            byzantineIndices.forEach(index => {
                this.nodes[index].type = 'byzantine';
            });
            this.log(`Reassigned Byzantine nodes: [${byzantineIndices.join(', ')}]`, 'failure');
        }

        // Randomly reassign leader from honest nodes
        const honestNodes = this.nodes.filter(node => node.type === 'honest');
        if (honestNodes.length > 0) {
            const randomLeaderIndex = Math.floor(Math.random() * honestNodes.length);
            const leaderNode = honestNodes[randomLeaderIndex];
            leaderNode.type = 'leader';
            this.log(`Reassigned leader: Node ${leaderNode.id}`, 'consensus');
        } else {
            this.log('Warning: No honest nodes available for leader selection!', 'failure');
        }

        // Update status and logs
        this.updateStatus();
        this.updatePhaseIndicator();
        
        const byzantineNodes = this.nodes.filter(n => n.type === 'byzantine').map(n => n.id);
        const leaderNode = this.nodes.find(n => n.type === 'leader');
        const honestNodeIds = this.nodes.filter(n => n.type === 'honest').map(n => n.id);
        
        this.log(`Node roles reassigned randomly!`, 'message');
        this.log(`Byzantine: [${byzantineNodes.join(', ')}], Leader: ${leaderNode ? leaderNode.id : 'None'}, Honest: [${honestNodeIds.join(', ')}]`, 'message');
    }

    async handleManualStep() {
        console.log('=== handleManualStep called ===');
        console.log(`Current state: manualStep=${this.manualStep}, currentPhase=${this.currentPhase}, isRunning=${this.isRunning}`);
        
        // If consensus is complete, reset for new consensus
        if (this.currentPhase === 'decision' && !this.isRunning) {
            this.manualStep = 0;
            this.currentPhase = 'idle';
            this.updatePhaseIndicator();
            this.resetNodeStates();
            document.getElementById('nextStepBtn').textContent = '➡️ Next Step';
            this.log('Ready for new manual consensus round', 'message');
            return;
        }

        // Prevent multiple clicks during processing
        if (this.isRunning && this.manualStep === 0) {
            console.log('Blocked: already starting consensus');
            return;
        }

        // Initialize consensus on first step
        if (this.manualStep === 0) {
            const leader = this.nodes.find(node => node.type === 'leader');
            if (!leader) {
                this.log('No leader found! Cannot start consensus.', 'failure');
                return;
            }
            
            this.isRunning = true;
            this.consensusRound++;
            this.log('Starting manual consensus round ' + this.consensusRound, 'consensus');
            this.resetNodeStates();
        }

        const nextStepBtn = document.getElementById('nextStepBtn');
        nextStepBtn.disabled = true;

        try {
            console.log(`Manual step: ${this.manualStep}, Current phase: ${this.currentPhase}`);
            switch (this.manualStep) {
                case 0:
                    await this.manualPhase1Proposal();
                    break;
                case 1:
                    await this.manualPhase2Voting();
                    break;
                case 2:
                    await this.manualPhase3Decision();
                    break;
            }
            this.manualStep++;
            console.log(`After increment, manual step: ${this.manualStep}`);
            
            // Only set isRunning to false for the final step (decision phase)
            if (this.manualStep > 2) {
                this.isRunning = false;
            }
            
        } catch (error) {
            this.log(`Error during manual step: ${error.message}`, 'failure');
        } finally {
            nextStepBtn.disabled = false;
        }
    }

    async manualPhase1Proposal() {
        this.currentPhase = 'proposal';
        this.updatePhaseIndicator();
        
        const leader = this.nodes.find(node => node.type === 'leader');
        leader.proposedValue = leader.value;
        leader.pulse = 1;
        
        this.log(`Phase 1: Leader ${leader.id} proposes value ${leader.proposedValue}`, 'consensus');
        
        // Send proposal to all nodes
        this.broadcastMessage(leader, leader.proposedValue, 'proposal');
        
        document.getElementById('nextStepBtn').textContent = '📝 Collect Votes';
    }

    async manualPhase2Voting() {
        console.log('Entering manualPhase2Voting()');
        this.currentPhase = 'voting';
        this.updatePhaseIndicator();
        
        this.log('Phase 2: Nodes responding to proposal...', 'consensus');
        
        this.collectConsensus();
        
        // Wait for message animations to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        document.getElementById('nextStepBtn').textContent = '✅ Final Decision';
    }

    async manualPhase3Decision() {
        this.currentPhase = 'decision';
        this.updatePhaseIndicator();
        
        this.log('Phase 3: Making consensus decision...', 'consensus');
        
        this.finalizeConsensus();
        
        this.isRunning = false;
        this.manualStep = 0;
        document.getElementById('nextStepBtn').textContent = '🔄 Start New';
    }

    resetNodeStates() {
        this.nodes.forEach(node => {
            node.proposedValue = null;
            node.receivedProposals = [];
            node.pulse = 0;
        });
    }

    startConsensus() {
        if (this.isRunning) return;

        const leader = this.nodes.find(node => node.type === 'leader');
        if (!leader) {
            this.log('No leader found!', 'failure');
            return;
        }

        this.isRunning = true;
        this.consensusRound++;
        this.currentPhase = 'proposal';
        this.log('Starting automatic consensus round ' + this.consensusRound, 'consensus');

        // Reset node states
        this.resetNodeStates();

        // Only run automatic mode if not in manual mode
        if (this.simulationMode === 'automatic') {
            this.executeNormalMode(leader);
        } else {
            this.log('Use Next Step button for manual progression', 'message');
            this.isRunning = false;
            return;
        }

        this.updateStatus();
        this.updatePhaseIndicator();
    }

    executeNormalMode(leader) {
        // Phase 1: Leader proposes value
        setTimeout(() => {
            this.currentPhase = 'proposal';
            this.updatePhaseIndicator();
            const proposedValue = leader.value;
            leader.proposedValue = proposedValue;
            leader.pulse = 1;
            this.log(`Leader ${leader.id} proposes value ${proposedValue}`, 'consensus');
            this.broadcastMessage(leader, proposedValue, 'proposal');
        }, 500);

        // Phase 2: Nodes respond
        setTimeout(() => {
            this.currentPhase = 'voting';
            this.updatePhaseIndicator();
            this.collectConsensus();
        }, 2000);

        // Phase 3: Decision
        setTimeout(() => {
            this.currentPhase = 'decision';
            this.updatePhaseIndicator();
            this.finalizeConsensus();
        }, 4000);

        // Reset phase
        setTimeout(() => {
            this.currentPhase = 'idle';
            this.isRunning = false;
            this.updatePhaseIndicator();
            this.updateStatus();
        }, 6000);
    }

    broadcastMessage(sender, value, type) {
        console.log(`Broadcasting message from node ${sender.id}, value: ${value}, type: ${type}`);
        this.nodes.forEach(receiver => {
            if (receiver.id !== sender.id) {
                this.messages.push({
                    from: sender.id,
                    to: receiver.id,
                    value: value,
                    type: type,
                    startTime: Date.now(),
                    duration: 1000 / this.animationSpeed,
                    progress: 0
                });
                this.messageCount++;
                console.log(`Created message from ${sender.id} to ${receiver.id}`);
            }
        });
    }

    collectConsensus() {
        const leader = this.nodes.find(node => node.type === 'leader');
        const proposedValue = leader.proposedValue;
        
        console.log(`Collecting consensus for proposed value: ${proposedValue}`);
        console.log(`Messages before: ${this.messages.length}`);

        this.nodes.forEach(node => {
            if (node.id !== leader.id) {
                if (node.type === 'byzantine') {
                    // Byzantine nodes might send conflicting or no response
                    const byzantineBehavior = Math.random();
                    if (byzantineBehavior < 0.3) {
                        // Send opposite value
                        const maliciousValue = 1 - proposedValue;
                        node.proposedValue = maliciousValue; // Set the Byzantine node's value
                        this.broadcastMessage(node, maliciousValue, 'response');
                        this.log(`Byzantine node ${node.id} sends malicious response: ${maliciousValue}`, 'failure');
                    } else if (byzantineBehavior < 0.6) {
                        // Send random value
                        const randomValue = Math.floor(Math.random() * 2);
                        node.proposedValue = randomValue; // Set the Byzantine node's value
                        this.broadcastMessage(node, randomValue, 'response');
                        this.log(`Byzantine node ${node.id} sends random response: ${randomValue}`, 'failure');
                    } else {
                        // No response (silent failure)
                        node.proposedValue = null; // Byzantine node doesn't participate
                        this.log(`Byzantine node ${node.id} fails silently (no response)`, 'failure');
                    }
                } else {
                    // Honest nodes echo the proposed value
                    node.proposedValue = proposedValue; // Set the honest node's value
                    this.broadcastMessage(node, proposedValue, 'response');
                    this.log(`Honest node ${node.id} responds: ${proposedValue}`, 'consensus');
                }
            }
        });
        
        console.log(`Messages after: ${this.messages.length}`);
    }

    finalizeConsensus() {
        const leader = this.nodes.find(node => node.type === 'leader');
        const proposedValue = leader.proposedValue;
        
        // Count votes
        const votes = { 0: 0, 1: 0 };
        const honestNodes = this.nodes.filter(node => node.type === 'honest' || node.type === 'leader');
        
        honestNodes.forEach(node => {
            if (node.proposedValue !== null) {
                votes[node.proposedValue]++;
            }
        });

        const totalHonestNodes = honestNodes.length;
        const byzantineNodes = this.nodes.filter(node => node.type === 'byzantine').length;
        
        // Byzantine Agreement: Need majority of honest nodes
        const consensusReached = this.validateConsensus(votes, totalHonestNodes);
        
        if (consensusReached) {
            const consensusValue = votes[0] > votes[1] ? 0 : 1;
            this.log(`Consensus reached! Agreed value: ${consensusValue}`, 'consensus');
            this.log(`Votes: 0=${votes[0]}, 1=${votes[1]} (${totalHonestNodes} honest nodes, ${byzantineNodes} Byzantine)`, 'consensus');
        } else {
            this.log(`Consensus failed! Insufficient honest node agreement`, 'failure');
            this.log(`Votes: 0=${votes[0]}, 1=${votes[1]} (${totalHonestNodes} honest nodes, ${byzantineNodes} Byzantine)`, 'failure');
        }

        // Highlight all nodes briefly
        this.nodes.forEach(node => {
            node.pulse = 1;
        });
    }

    validateConsensus(votes, totalHonestNodes) {
        // In Byzantine Agreement, we need a majority of honest nodes to agree
        const maxVotes = Math.max(votes[0], votes[1]);
        return maxVotes > totalHonestNodes / 2;
    }

    resetNetwork() {
        this.isRunning = false;
        this.manualStep = 0;
        this.currentStepIndex = 0;
        this.stepQueue = [];
        this.messages = [];
        this.currentPhase = 'idle';
        
        // Reset button text
        document.getElementById('nextStepBtn').textContent = '➡️ Next Step';
        document.getElementById('nextStepBtn').disabled = false;
        
        this.initializeNetwork();
        this.log('Network reset', 'message');
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawConnections();
        this.updateMessages();
        this.drawMessages();
        this.drawNodes();

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    drawConnections() {
        this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
        this.ctx.lineWidth = 2;

        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.nodes[i].position.x, this.nodes[i].position.y);
                this.ctx.lineTo(this.nodes[j].position.x, this.nodes[j].position.y);
                this.ctx.stroke();
            }
        }
    }

    updateMessages() {
        const now = Date.now();
        this.messages = this.messages.filter(message => {
            const elapsed = now - message.startTime;
            message.progress = Math.min(elapsed / message.duration, 1);
            return message.progress < 1;
        });
    }

    drawMessages() {
        this.messages.forEach(message => {
            const fromNode = this.nodes[message.from];
            const toNode = this.nodes[message.to];
            
            const x = fromNode.position.x + (toNode.position.x - fromNode.position.x) * message.progress;
            const y = fromNode.position.y + (toNode.position.y - fromNode.position.y) * message.progress;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 8, 0, 2 * Math.PI);
            this.ctx.fillStyle = message.type === 'proposal' ? '#3b82f6' : '#10b981';
            this.ctx.fill();
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Draw value
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(message.value.toString(), x, y + 4);
        });
    }

    drawNodes() {
        this.nodes.forEach(node => {
            const x = node.position.x;
            const y = node.position.y;
            const radius = 30 + (node.pulse * 10);
            
            // Node colors based on type
            let color;
            switch (node.type) {
                case 'leader': color = '#f59e0b'; break;
                case 'byzantine': color = '#ef4444'; break;
                case 'honest': color = '#10b981'; break;
                default: color = '#64748b';
            }
            
            // Draw node
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            this.ctx.strokeStyle = this.darkenColor(color, 0.2);
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Draw node ID
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(node.id.toString(), x, y - 5);
            
            // Draw value
            this.ctx.font = 'bold 12px Arial';
            this.ctx.fillText(`v:${node.value}`, x, y + 10);
            
            // Animate pulse
            if (node.pulse > 0) {
                node.pulse -= 0.02;
                if (node.pulse < 0) node.pulse = 0;
            }
        });
    }

    darkenColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount * 255);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount * 255);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount * 255);
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }

    updatePhaseIndicator() {
        const indicator = document.getElementById('phaseIndicator');
        
        const phaseText = {
            'idle': 'Ready',
            'proposal': 'Phase 1: Leader Proposal',
            'voting': 'Phase 2: Node Responses',
            'decision': 'Phase 3: Consensus Decision'
        };

        let displayText = phaseText[this.currentPhase] || 'Ready';
        
        if (this.simulationMode === 'manual') {
            displayText += ' (Manual Mode)';
        } else {
            displayText += ' (Automatic Mode)';
        }

        indicator.textContent = displayText;
    }

    updateStatus() {
        const nodeCount = this.nodes.length;
        const faultyCount = this.nodes.filter(node => node.type === 'byzantine').length;
        const tolerance = Math.floor((nodeCount - 1) / 3);

        let statusText = 'Ready';
        if (this.isRunning) {
            statusText = 'Running';
        } else if (this.currentPhase !== 'idle') {
            statusText = 'Completed';
        }

        const phaseNames = {
            'idle': 'Idle',
            'proposal': 'Leader Proposal',
            'voting': 'Node Voting',
            'decision': 'Making Decision'
        };

        document.getElementById('networkStatus').textContent = statusText;
        document.getElementById('consensusRound').textContent = this.consensusRound;
        document.getElementById('messageCount').textContent = this.messageCount;
        document.getElementById('currentPhase').textContent = phaseNames[this.currentPhase] || 'Unknown';
        
        // Enhanced Byzantine tolerance display with formula explanation
        const formula = `f=${faultyCount} ≤ ⌊(n-1)/3⌋ = ⌊(${nodeCount}-1)/3⌋ = ${tolerance}`;
        const status = faultyCount <= tolerance ? 'Safe' : 'Unsafe';
        document.getElementById('byzantineTolerance').textContent = `${formula} (${status})`;
    }

    log(message, type = 'message') {
        const logsContainer = document.getElementById('logs');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        logsContainer.appendChild(logEntry);
        logsContainer.scrollTop = logsContainer.scrollHeight;

        // Keep only last 50 log entries
        while (logsContainer.children.length > 50) {
            logsContainer.removeChild(logsContainer.firstChild);
        }
    }
}

// Info modal functions
function toggleInfoModal() {
    const modal = document.getElementById('infoModal');
    if (modal.classList.contains('show')) {
        closeInfoModal();
    } else {
        openInfoModal();
    }
}

function openInfoModal() {
    const modal = document.getElementById('infoModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeInfoModal(event) {
    // Close if clicked outside the modal content or on close button
    if (!event || event.target === document.getElementById('infoModal') || event.target.classList.contains('close-button')) {
        const modal = document.getElementById('infoModal');
        modal.classList.remove('show');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// Make modal functions globally available
window.toggleInfoModal = toggleInfoModal;
window.openInfoModal = openInfoModal;
window.closeInfoModal = closeInfoModal;

// Orientation detection for mobile devices
function checkOrientation() {
    const overlay = document.querySelector('.rotate-device-overlay');
    if (window.innerWidth <= 768 && window.innerHeight > window.innerWidth) {
        // Portrait mode on mobile
        overlay.style.display = 'flex !important';
        document.querySelector('.app-container').style.display = 'none !important';
    } else {
        // Landscape mode or desktop
        overlay.style.display = 'none';
        document.querySelector('.app-container').style.display = 'grid';
    }
}

// Initialize simulation when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ByzantineSimulation();
    
    // Set up orientation detection
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => {
        setTimeout(checkOrientation, 100); // Small delay for orientation change
    });

    // Keyboard shortcuts for info modal
    document.addEventListener('keydown', (e) => {
        // Close modal with Escape key
        if (e.key === 'Escape') {
            closeInfoModal();
            return;
        }
        
        // Info modal shortcut
        if (e.key === 'F1' || (e.ctrlKey && e.key === 'h')) {
            e.preventDefault();
            toggleInfoModal();
            return;
        }
    });
});
