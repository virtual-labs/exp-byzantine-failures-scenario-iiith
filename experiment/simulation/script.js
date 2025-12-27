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
        // Debounced resize handler for better performance
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.resizeCanvas();
            }, 100);
        });
        // Handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.resizeCanvas();
            }, 200);
        });
    }

    resizeCanvas() {
        const container = document.querySelector('.simulation-area');
        if (!container) return;
        
        // Get computed styles to account for padding
        const computedStyle = getComputedStyle(container);
        const paddingX = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
        const paddingY = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);
        
        // Calculate available space
        const availableWidth = container.clientWidth - paddingX;
        const availableHeight = container.clientHeight - paddingY;
        
        // Set minimum dimensions for mobile
        const minWidth = 280;
        const minHeight = 200;
        
        this.canvas.width = Math.max(availableWidth, minWidth);
        this.canvas.height = Math.max(availableHeight, minHeight);
        
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

        // Create nodes with initial values (not displayed initially)
        for (let i = 0; i < nodeCount; i++) {
            this.nodes.push({
                id: i,
                position: { x: 0, y: 0 },
                type: 'honest',
                value: Math.floor(Math.random() * 2),
                proposedValue: null,
                prepareMessages: [],
                commitMessages: [],
                preparedValue: null,
                committedValue: null,
                receivedValue: null,
                sentValue: null,
                phase: 'idle',
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
            leaderNode.value = 0; // Leader always proposes value 0
            this.log(`Leader randomly assigned: Node ${leaderNode.id} (will propose value 0)`, 'consensus');
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
        
        // Responsive radius calculation with minimum padding
        const padding = Math.min(50, Math.min(this.canvas.width, this.canvas.height) * 0.15);
        const maxRadius = (Math.min(this.canvas.width, this.canvas.height) / 2) - padding;
        const radius = Math.max(60, Math.min(maxRadius, Math.min(this.canvas.width, this.canvas.height) * 0.35));

        this.nodes.forEach((node, index) => {
            const angle = (index * 2 * Math.PI) / this.nodes.length - Math.PI / 2; // Start from top
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
            node.prepareMessages = [];
            node.commitMessages = [];
            node.preparedValue = null;
            node.committedValue = null;
            node.receivedValue = null;
            node.sentValue = null;
            node.phase = 'idle';
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
            leaderNode.value = 0; // Leader always proposes value 0
            this.log(`Reassigned leader: Node ${leaderNode.id} (will propose value 0)`, 'consensus');
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
        if (this.currentPhase === 'commit' && !this.isRunning) {
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
            this.log('Starting manual PBFT consensus round ' + this.consensusRound, 'consensus');
            this.resetNodeStates();
        }

        const nextStepBtn = document.getElementById('nextStepBtn');
        nextStepBtn.disabled = true;

        try {
            console.log(`Manual step: ${this.manualStep}, Current phase: ${this.currentPhase}`);
            switch (this.manualStep) {
                case 0:
                    await this.manualPhase1PrePrepare();
                    break;
                case 1:
                    await this.manualPhase2Prepare();
                    break;
                case 2:
                    await this.manualPhase3Commit();
                    break;
            }
            this.manualStep++;
            console.log(`After increment, manual step: ${this.manualStep}`);
            
            // Only set isRunning to false for the final step (commit phase)
            if (this.manualStep > 2) {
                this.isRunning = false;
            }
            
        } catch (error) {
            this.log(`Error during manual step: ${error.message}`, 'failure');
        } finally {
            nextStepBtn.disabled = false;
        }
    }

    async manualPhase1PrePrepare() {
        this.currentPhase = 'pre-prepare';
        this.updatePhaseIndicator();
        
        const leader = this.nodes.find(node => node.type === 'leader');
        leader.proposedValue = leader.value;
        leader.phase = 'pre-prepare';
        leader.pulse = 1;
        
        this.log(`Phase 1 (Pre-Prepare): Leader ${leader.id} proposes value ${leader.proposedValue}`, 'consensus');
        
        // Leader broadcasts pre-prepare message to all replicas
        this.nodes.forEach(replica => {
            if (replica.id !== leader.id) {
                replica.proposedValue = leader.proposedValue; // All nodes receive the proposal
                replica.receivedValue = leader.proposedValue; // Track what they received
                this.messages.push({
                    from: leader.id,
                    to: replica.id,
                    value: leader.proposedValue,
                    type: 'pre-prepare',
                    startTime: Date.now(),
                    duration: 1000 / this.animationSpeed,
                    progress: 0
                });
                this.messageCount++;
            }
        });
        
        document.getElementById('nextStepBtn').textContent = '� Prepare Phase';
    }

    async manualPhase2Prepare() {
        this.currentPhase = 'prepare';
        this.updatePhaseIndicator();
        
        this.log('Phase 2 (Prepare): Replicas broadcasting prepare messages...', 'consensus');
        
        const leader = this.nodes.find(node => node.type === 'leader');
        const proposedValue = leader.proposedValue;
        
        // Each replica (except leader) broadcasts prepare messages to all other nodes
        this.nodes.forEach(sender => {
            if (sender.id !== leader.id) {
                sender.phase = 'prepare';
                sender.pulse = 1;
                
                // Determine what message this node will send based on its type
                let messageValue = proposedValue;
                let messageType = 'prepare';
                
                if (sender.type === 'byzantine') {
                    // Byzantine nodes always send value 1 (opposite of leader's 0)
                    messageValue = 1;
                    sender.sentValue = 1; // Track what Byzantine node sent
                    this.log(`Byzantine node ${sender.id} sends malicious prepare: ${messageValue} (received ${sender.receivedValue})`, 'failure');
                } else {
                    // Honest nodes send prepare with the proposed value they received
                    sender.sentValue = messageValue; // Track what honest node sent
                    this.log(`Honest node ${sender.id} sends prepare: ${messageValue} (received ${sender.receivedValue})`, 'consensus');
                }
                
                // Send prepare message to all other nodes
                this.nodes.forEach(receiver => {
                    if (receiver.id !== sender.id) {
                        // Store prepare message in receiver
                        if (!receiver.prepareMessages) receiver.prepareMessages = [];
                        receiver.prepareMessages.push({
                            from: sender.id,
                            value: messageValue,
                            type: 'prepare'
                        });
                        
                        this.messages.push({
                            from: sender.id,
                            to: receiver.id,
                            value: messageValue,
                            type: 'prepare',
                            startTime: Date.now(),
                            duration: 1000 / this.animationSpeed,
                            progress: 0
                        });
                        this.messageCount++;
                    }
                });
            }
        });
        
        // Wait for message animations to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        document.getElementById('nextStepBtn').textContent = '✅ Commit Phase';
    }

    async manualPhase3Commit() {
        this.currentPhase = 'commit';
        this.updatePhaseIndicator();
        
        this.log('Phase 3 (Commit): Processing prepare messages and making decisions...', 'consensus');
        
        const leader = this.nodes.find(node => node.type === 'leader');
        const proposedValue = leader.proposedValue;
        const totalNodes = this.nodes.length;
        const byzantineCount = this.nodes.filter(n => n.type === 'byzantine').length;
        const requiredPrepares = Math.floor((totalNodes + byzantineCount) / 2) + 1; // 2f + 1 prepare messages needed
        
        // Each node processes prepare messages and decides whether to commit
        this.nodes.forEach(node => {
            if (node.id !== leader.id) { // Replicas process prepare messages
                node.phase = 'commit';
                
                // Count prepare messages for the proposed value
                const preparesForValue = (node.prepareMessages || []).filter(msg => 
                    msg.value === proposedValue && msg.type === 'prepare'
                ).length;
                
                // Add leader's implicit prepare (leader doesn't send prepare to itself)
                const totalPrepares = preparesForValue + 1;
                
                if (totalPrepares >= requiredPrepares) {
                    node.preparedValue = proposedValue;
                    node.pulse = 1;
                    
                    if (node.type === 'honest') {
                        this.log(`Honest node ${node.id} received ${totalPrepares} prepares, entering commit phase`, 'consensus');
                        
                        // Honest node broadcasts commit message
                        this.nodes.forEach(receiver => {
                            if (receiver.id !== node.id) {
                                if (!receiver.commitMessages) receiver.commitMessages = [];
                                receiver.commitMessages.push({
                                    from: node.id,
                                    value: proposedValue,
                                    type: 'commit'
                                });
                                
                                this.messages.push({
                                    from: node.id,
                                    to: receiver.id,
                                    value: proposedValue,
                                    type: 'commit',
                                    startTime: Date.now(),
                                    duration: 1000 / this.animationSpeed,
                                    progress: 0
                                });
                                this.messageCount++;
                            }
                        });
                    } else if (node.type === 'byzantine') {
                        // Byzantine nodes always send conflicting commit (value 1)
                        const maliciousValue = 1;
                        this.log(`Byzantine node ${node.id} sends conflicting commit: ${maliciousValue}`, 'failure');
                        
                        this.nodes.forEach(receiver => {
                            if (receiver.id !== node.id) {
                                if (!receiver.commitMessages) receiver.commitMessages = [];
                                receiver.commitMessages.push({
                                    from: node.id,
                                    value: maliciousValue,
                                    type: 'commit'
                                });
                                
                                this.messages.push({
                                    from: node.id,
                                    to: receiver.id,
                                    value: maliciousValue,
                                    type: 'commit',
                                    startTime: Date.now(),
                                    duration: 1000 / this.animationSpeed,
                                    progress: 0
                                });
                                this.messageCount++;
                            }
                        });
                    }
                } else {
                    this.log(`Node ${node.id} received only ${totalPrepares} prepares (need ${requiredPrepares}), cannot proceed to commit`, 'message');
                }
            }
        });
        
        // Process leader's commit decision
        leader.phase = 'commit';
        leader.preparedValue = proposedValue;
        this.log(`Leader ${leader.id} enters commit phase for value ${proposedValue}`, 'consensus');
        
        // Leader also sends commit messages
        this.nodes.forEach(receiver => {
            if (receiver.id !== leader.id) {
                if (!receiver.commitMessages) receiver.commitMessages = [];
                receiver.commitMessages.push({
                    from: leader.id,
                    value: proposedValue,
                    type: 'commit'
                });
                
                this.messages.push({
                    from: leader.id,
                    to: receiver.id,
                    value: proposedValue,
                    type: 'commit',
                    startTime: Date.now(),
                    duration: 1000 / this.animationSpeed,
                    progress: 0
                });
                this.messageCount++;
            }
        });
        
        // Wait for commit message animations
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Finalize consensus - check commit messages
        this.finalizeConsensus();
        
        this.isRunning = false;
        this.manualStep = 0;
        document.getElementById('nextStepBtn').textContent = '🔄 Start New';
    }

    resetNodeStates() {
        this.nodes.forEach(node => {
            node.proposedValue = null;
            node.prepareMessages = [];
            node.commitMessages = [];
            node.preparedValue = null;
            node.committedValue = null;
            node.receivedValue = null;
            node.sentValue = null;
            node.phase = 'idle';
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
            this.executeAutomaticPBFT(leader);
        } else {
            this.log('Manual PBFT mode: Click "Next Step" to progress through consensus phases', 'message');
            this.isRunning = false;
            return;
        }

        this.updateStatus();
        this.updatePhaseIndicator();
    }

    executeAutomaticPBFT(leader) {
        // Phase 1: Pre-Prepare - Leader proposes value
        setTimeout(() => {
            this.currentPhase = 'pre-prepare';
            this.updatePhaseIndicator();
            leader.proposedValue = leader.value;
            this.log(`Automatic PBFT Phase 1: Leader ${leader.id} pre-prepare with value ${leader.proposedValue}`, 'consensus');
            
            // Broadcast pre-prepare to all replicas
            this.nodes.forEach(replica => {
                if (replica.id !== leader.id) {
                    replica.proposedValue = leader.proposedValue;
                    this.messages.push({
                        from: leader.id,
                        to: replica.id,
                        value: leader.proposedValue,
                        type: 'pre-prepare',
                        startTime: Date.now(),
                        duration: 1000 / this.animationSpeed,
                        progress: 0
                    });
                    this.messageCount++;
                }
            });
        }, 500);

        // Phase 2: Prepare - Replicas exchange prepare messages
        setTimeout(() => {
            this.currentPhase = 'prepare';
            this.updatePhaseIndicator();
            this.log('Automatic PBFT Phase 2: Replicas sending prepare messages', 'consensus');
            
            const proposedValue = leader.proposedValue;
            this.nodes.forEach(sender => {
                if (sender.id !== leader.id) {
                    let messageValue = proposedValue;
                    
                    if (sender.type === 'byzantine') {
                        const behavior = Math.random();
                        if (behavior < 0.4) {
                            messageValue = 1 - proposedValue;
                            this.log(`Byzantine node ${sender.id} sends conflicting prepare: ${messageValue}`, 'failure');
                        } else if (behavior < 0.7) {
                            messageValue = Math.floor(Math.random() * 2);
                            this.log(`Byzantine node ${sender.id} sends random prepare: ${messageValue}`, 'failure');
                        } else {
                            this.log(`Byzantine node ${sender.id} stays silent in prepare`, 'failure');
                            return;
                        }
                    }
                    
                    // Send prepare to all other nodes
                    this.nodes.forEach(receiver => {
                        if (receiver.id !== sender.id) {
                            if (!receiver.prepareMessages) receiver.prepareMessages = [];
                            receiver.prepareMessages.push({
                                from: sender.id,
                                value: messageValue,
                                type: 'prepare'
                            });
                            
                            this.messages.push({
                                from: sender.id,
                                to: receiver.id,
                                value: messageValue,
                                type: 'prepare',
                                startTime: Date.now(),
                                duration: 1000 / this.animationSpeed,
                                progress: 0
                            });
                            this.messageCount++;
                        }
                    });
                }
            });
        }, 2500);

        // Phase 3: Commit - Nodes send commit messages
        setTimeout(() => {
            this.currentPhase = 'commit';
            this.updatePhaseIndicator();
            this.log('Automatic PBFT Phase 3: Processing prepares and sending commits', 'consensus');
            
            const proposedValue = leader.proposedValue;
            const totalNodes = this.nodes.length;
            const byzantineCount = this.nodes.filter(n => n.type === 'byzantine').length;
            const requiredPrepares = Math.floor((totalNodes + byzantineCount) / 2) + 1;
            
            // All nodes (including leader) send commit messages
            this.nodes.forEach(sender => {
                let shouldCommit = true;
                
                if (sender.id !== leader.id) {
                    // Check if replica received enough prepare messages
                    const preparesForValue = (sender.prepareMessages || []).filter(msg => 
                        msg.value === proposedValue && msg.type === 'prepare'
                    ).length + 1; // +1 for leader's implicit prepare
                    
                    shouldCommit = preparesForValue >= requiredPrepares;
                    
                    if (!shouldCommit) {
                        this.log(`Node ${sender.id} cannot commit (only ${preparesForValue} prepares)`, 'message');
                        return;
                    }
                }
                
                if (sender.type === 'honest' || sender.type === 'leader') {
                    // Send commit messages to all other nodes
                    this.nodes.forEach(receiver => {
                        if (receiver.id !== sender.id) {
                            if (!receiver.commitMessages) receiver.commitMessages = [];
                            receiver.commitMessages.push({
                                from: sender.id,
                                value: proposedValue,
                                type: 'commit'
                            });
                            
                            this.messages.push({
                                from: sender.id,
                                to: receiver.id,
                                value: proposedValue,
                                type: 'commit',
                                startTime: Date.now(),
                                duration: 1000 / this.animationSpeed,
                                progress: 0
                            });
                            this.messageCount++;
                        }
                    });
                } else if (sender.type === 'byzantine') {
                    const behavior = Math.random();
                    if (behavior < 0.5) {
                        const maliciousValue = 1 - proposedValue;
                        this.log(`Byzantine node ${sender.id} sends conflicting commit: ${maliciousValue}`, 'failure');
                        
                        this.nodes.forEach(receiver => {
                            if (receiver.id !== sender.id) {
                                if (!receiver.commitMessages) receiver.commitMessages = [];
                                receiver.commitMessages.push({
                                    from: sender.id,
                                    value: maliciousValue,
                                    type: 'commit'
                                });
                                
                                this.messages.push({
                                    from: sender.id,
                                    to: receiver.id,
                                    value: maliciousValue,
                                    type: 'commit',
                                    startTime: Date.now(),
                                    duration: 1000 / this.animationSpeed,
                                    progress: 0
                                });
                                this.messageCount++;
                            }
                        });
                    }
                }
            });
        }, 5000);

        // Phase 4: Finalize consensus
        setTimeout(() => {
            this.log('Automatic PBFT Phase 4: Finalizing consensus', 'consensus');
            this.finalizeConsensus();
        }, 7500);

        // Reset phase
        setTimeout(() => {
            this.currentPhase = 'idle';
            this.isRunning = false;
            this.updatePhaseIndicator();
            this.updateStatus();
        }, 9000);
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
        const totalNodes = this.nodes.length;
        const byzantineCount = this.nodes.filter(n => n.type === 'byzantine').length;
        const requiredCommits = Math.floor((totalNodes + byzantineCount) / 2) + 1; // 2f + 1 commit messages needed
        
        this.log('Finalizing PBFT consensus...', 'consensus');
        
        // Check each node's commit messages to determine if consensus is reached
        let consensusNodes = [];
        
        this.nodes.forEach(node => {
            if (node.type === 'honest' || node.type === 'leader') {
                // Count commit messages for the proposed value (including leader's implicit commit)
                const commitMessagesForValue = (node.commitMessages || []).filter(msg => 
                    msg.value === proposedValue && msg.type === 'commit'
                ).length;
                
                // Add 1 for leader's implicit commit (if this node is not the leader)
                const totalCommits = commitMessagesForValue + (node.id === leader.id ? 0 : 1);
                
                if (totalCommits >= requiredCommits) {
                    node.committedValue = proposedValue;
                    consensusNodes.push(node.id);
                    this.log(`Node ${node.id} commits value ${proposedValue} (${totalCommits} commits received)`, 'consensus');
                } else {
                    this.log(`Node ${node.id} cannot commit (only ${totalCommits} commits, need ${requiredCommits})`, 'message');
                }
            }
        });
        
        const honestNodes = this.nodes.filter(n => n.type === 'honest' || n.type === 'leader');
        const byzantineNodes = this.nodes.filter(n => n.type === 'byzantine');
        
        // PBFT consensus is reached if all honest nodes commit the same value
        const consensusReached = consensusNodes.length === honestNodes.length;
        
        if (consensusReached && consensusNodes.length > 0) {
            this.log(`🎉 PBFT Consensus REACHED! All ${consensusNodes.length} honest nodes agreed on value: ${proposedValue}`, 'consensus');
            this.log(`✓ Pre-Prepare: Leader ${leader.id} proposed ${proposedValue}`, 'consensus');
            this.log(`✓ Prepare: Nodes exchanged prepare messages`, 'consensus');
            this.log(`✓ Commit: Nodes received sufficient commit messages (≥${requiredCommits})`, 'consensus');
            this.log(`Network: ${totalNodes} total nodes (${honestNodes.length} honest, ${byzantineNodes.length} Byzantine)`, 'message');
        } else {
            this.log(`❌ PBFT Consensus FAILED! Only ${consensusNodes.length}/${honestNodes.length} honest nodes could commit`, 'failure');
            this.log(`Not enough commit messages received (need ${requiredCommits} commits)`, 'failure');
            this.log(`Network: ${totalNodes} total nodes (${honestNodes.length} honest, ${byzantineNodes.length} Byzantine)`, 'failure');
        }

        // Highlight all nodes that reached consensus
        consensusNodes.forEach(nodeId => {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) node.pulse = 1;
        });
        
        // Also highlight Byzantine nodes to show their behavior
        byzantineNodes.forEach(node => {
            node.pulse = 0.5; // Different pulse for Byzantine nodes
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
        // Responsive line width based on canvas size
        const canvasMin = Math.min(this.canvas.width, this.canvas.height);
        const lineWidth = Math.max(1, Math.min(2, canvasMin * 0.005));
        
        this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
        this.ctx.lineWidth = lineWidth;

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
        // Calculate responsive message size based on canvas size
        const canvasMin = Math.min(this.canvas.width, this.canvas.height);
        const messageRadius = Math.max(5, Math.min(8, canvasMin * 0.02));
        const messageFontSize = Math.max(8, Math.min(12, canvasMin * 0.03));
        
        this.messages.forEach(message => {
            const fromNode = this.nodes[message.from];
            const toNode = this.nodes[message.to];
            
            const x = fromNode.position.x + (toNode.position.x - fromNode.position.x) * message.progress;
            const y = fromNode.position.y + (toNode.position.y - fromNode.position.y) * message.progress;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, messageRadius, 0, 2 * Math.PI);
            this.ctx.fillStyle = message.type === 'proposal' ? '#3b82f6' : '#10b981';
            this.ctx.fill();
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = Math.max(1, messageRadius * 0.25);
            this.ctx.stroke();
            
            // Draw value
            this.ctx.fillStyle = 'white';
            this.ctx.font = `bold ${messageFontSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(message.value.toString(), x, y + (messageFontSize * 0.35));
        });
    }

    drawNodes() {
        // Calculate responsive node size based on canvas size
        const canvasMin = Math.min(this.canvas.width, this.canvas.height);
        const baseRadius = Math.max(18, Math.min(30, canvasMin * 0.06));
        const baseFontSize = Math.max(10, Math.min(16, canvasMin * 0.035));
        const smallFontSize = Math.max(8, Math.min(10, canvasMin * 0.025));
        
        this.nodes.forEach(node => {
            const x = node.position.x;
            const y = node.position.y;
            const radius = baseRadius + (node.pulse * 8);
            
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
            this.ctx.lineWidth = Math.max(2, baseRadius * 0.1);
            this.ctx.stroke();
            
            // Draw node ID
            this.ctx.fillStyle = 'white';
            this.ctx.font = `bold ${baseFontSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(node.id.toString(), x, y - (baseRadius * 0.15));
            
            // Draw node information based on phase
            this.ctx.font = `bold ${smallFontSize}px Arial`;
            if (this.currentPhase === 'idle' || node.phase === 'idle') {
                // Initially show nothing (just node number)
            } else if (this.currentPhase === 'pre-prepare' && node.receivedValue !== null) {
                // After pre-prepare phase, show what they received
                this.ctx.fillText(`R:${node.receivedValue}`, x, y + (baseRadius * 0.3));
            } else if (this.currentPhase === 'prepare' && node.sentValue !== null) {
                // During/after prepare phase, show received and sent values
                this.ctx.fillText(`R:${node.receivedValue} S:${node.sentValue}`, x, y + (baseRadius * 0.3));
            } else if (this.currentPhase === 'commit') {
                // During commit phase, show the full story
                if (node.receivedValue !== null && node.sentValue !== null) {
                    this.ctx.fillText(`R:${node.receivedValue} S:${node.sentValue}`, x, y + (baseRadius * 0.3));
                } else if (node.receivedValue !== null) {
                    this.ctx.fillText(`R:${node.receivedValue}`, x, y + (baseRadius * 0.3));
                }
            }
            
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
            'pre-prepare': 'Phase 1: Pre-Prepare (Leader Proposal)',
            'prepare': 'Phase 2: Prepare (Replica Validation)', 
            'commit': 'Phase 3: Commit (Final Agreement)'
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
            'pre-prepare': 'Pre-Prepare',
            'prepare': 'Prepare',
            'commit': 'Commit'
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

// Orientation detection for mobile devices - now handled by CSS media queries
// This function only handles dynamic layout adjustments
function checkOrientation() {
    const appContainer = document.querySelector('.app-container');
    const isVerySmallLandscape = window.innerHeight < 400 && window.innerWidth > window.innerHeight;
    
    if (isVerySmallLandscape) {
        // Very small landscape - CSS will show overlay
        return;
    }
    
    // For all other cases, ensure app container uses proper display
    // CSS handles the grid/flex layout based on screen size
    if (appContainer) {
        // Remove any inline styles that might override CSS
        appContainer.style.removeProperty('display');
    }
}

// Initialize simulation when page loads
document.addEventListener('DOMContentLoaded', () => {
    const simulation = new ByzantineSimulation();
    
    // Make simulation globally accessible for debugging if needed
    window.byzantineSimulation = simulation;
    
    // Set up orientation detection
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => {
        setTimeout(checkOrientation, 100); // Small delay for orientation change
        // Trigger canvas resize after orientation change
        setTimeout(() => {
            if (window.byzantineSimulation) {
                window.byzantineSimulation.resizeCanvas();
            }
        }, 300);
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
