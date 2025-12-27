This experiment simulates a distributed system with a set of nodes that need to agree on a common value. Some of these nodes can be Byzantine, meaning they can behave maliciously.

Simulation Controls

The simulation provides the following controls:

*   **Number of Nodes (n):** You can set the total number of nodes in the system. The system requires `n > 3t` to be fault-tolerant, where `t` is the number of Byzantine nodes.
*   **Number of Byzantine Nodes (t):** You can set the number of nodes that will exhibit Byzantine behavior. These nodes will send conflicting or incorrect messages to other nodes.
*   **Client Request:** You can initiate a request from a client to the primary node. The request will contain a value that the nodes need to agree upon.
*   **Run Simulation:** This button starts the simulation of the PBFT algorithm.

Steps to run the experiment

1.  **Set the number of nodes (n) and Byzantine nodes (t).** Ensure that `n > 3t`. For example, you can start with `n=4` and `t=1`.
2.  **Initiate a client request.** The client will send a request to the primary node (Node 0).
3.  **Run the simulation.** Observe the messages being passed between the nodes in the simulation log.
    *   The primary node sends a `pre-prepare` message to the backup nodes.
    *   The backup nodes send `prepare` messages to each other.
    *   Once a node receives `2t` matching `prepare` messages, it sends a `commit` message.
    *   Once a node receives `2t+1` `commit` messages, it executes the request and sends a `reply` to the client.
4.  **Observe the behavior of Byzantine nodes.** The Byzantine nodes will be highlighted, and their malicious messages will be visible in the log. For example, a Byzantine node might send a "retreat" message when the correct message is "attack".
5.  **Verify the outcome.** Despite the presence of Byzantine nodes, the loyal nodes should be able to reach a consensus on the correct value and send the correct reply to the client. The client will wait for `t+1` identical replies before accepting the result.
6.  **Experiment with different values of n and t.** Try to set `n <= 3t` (e.g., `n=3`, `t=1`). Observe that the system is unable to reach a consensus in this case. This demonstrates the `n > 3t` condition for Byzantine fault tolerance.

What to Observe

*   The sequence of messages (`pre-prepare`, `prepare`, `commit`, `reply`).
*   How loyal nodes handle messages from Byzantine nodes.
*   The final consensus reached by the loyal nodes.
*   The conditions under which the system fails to reach a consensus.