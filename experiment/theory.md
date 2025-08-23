### Introduction to Distributed Systems

A distributed system is a collection of independent computers that appears to its users as a single coherent system. These computers, often called nodes, communicate with each other by passing messages to coordinate their actions. Distributed systems are designed to be reliable, scalable, and efficient. However, they are also susceptible to various types of failures.

### Types of Failures in Distributed Systems

Failures in distributed systems can be broadly categorized as:

1.  **Crash Failures:** A component simply stops working. This is the simplest type of failure to handle.
2.  **Omission Failures:** A component fails to send or receive messages.
3.  **Timing Failures:** A component's response time is outside the specified time interval.
4.  **Byzantine Failures:** This is the most severe type of failure. A component can behave arbitrarily and maliciously. It might send conflicting information to different parts of the system, corrupt data, or appear to be working correctly to some nodes while appearing to have failed to others.

### The Byzantine Generals' Problem

The Byzantine Generals' Problem is a classic thought experiment that illustrates the challenge of achieving consensus in a distributed system in the presence of Byzantine failures. The problem is described as follows:

Imagine several divisions of the Byzantine army are camped outside an enemy city, each commanded by a general. The generals can communicate with each other only by messenger. After observing the enemy, they must decide upon a common plan of action. However, some of the generals may be traitors, trying to prevent the loyal generals from reaching an agreement.

The loyal generals must all agree on the same plan of action (e.g., "attack" or "retreat") and execute it in a coordinated manner. A small number of traitors should not be able to cause the loyal generals to adopt a bad plan.

The problem highlights that for a system with `n` generals, of which `t` are traitors, a solution can be found only if `n > 3t`. In other words, more than two-thirds of the components must be honest for the system to be able to reach a consensus.

### Byzantine Fault Tolerance (BFT)

Byzantine Fault Tolerance (BFT) is the property of a system that allows it to tolerate Byzantine failures. BFT algorithms are designed to achieve consensus and maintain correct operation even when some components are behaving maliciously.

One of the first and most famous BFT algorithms is the **Practical Byzantine Fault Tolerance (PBFT)** algorithm. PBFT works in a round-based fashion and involves a series of steps:

1.  **Request:** A client sends a request to the primary (leader) node.
2.  **Pre-prepare:** The primary node multicasts the request to all the backup nodes.
3.  **Prepare:** The backup nodes execute the request and then multicast a prepare message to all other nodes.
4.  **Commit:** After receiving `2t` prepare messages from different nodes that match the pre-prepare message, a node multicasts a commit message.
5.  **Reply:** After receiving `2t + 1` commit messages, a node executes the request and sends a reply to the client.

The client waits for `t + 1` identical replies from different nodes before accepting the result. This ensures that the result is valid even if `t` nodes are faulty.

### Relevance in Modern Systems

Byzantine failures are a significant concern in modern distributed systems, especially in areas like:

*   **Blockchain and Cryptocurrencies:** Blockchains like Bitcoin and Ethereum rely on BFT to ensure the integrity of the ledger. Miners (or validators) must agree on the set of transactions to be included in a new block, even if some miners are malicious.
*   **Aerospace and Aviation:** Flight control systems in airplanes are often distributed and must be highly fault-tolerant. A Byzantine failure in one of the flight computers could have catastrophic consequences.
*   **Cloud Computing:** Large-scale cloud services rely on distributed databases and coordination services that need to be resilient to Byzantine failures.

This experiment will simulate a Byzantine failure scenario to help you understand the challenges and solutions for building reliable distributed systems.