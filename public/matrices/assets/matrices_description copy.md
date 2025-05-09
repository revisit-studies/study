## What are adjacency matrices?

Adjacency matrices are a simple and structured way to represent networks or graphs. In a network, we have nodes (also called vertices) and links (also called edges) that connect them. An adjacency matrix captures this information in a table format, where each cell shows whether there is a link between a pair of nodes.

Think of an adjacency matrix like a table:

- The rows and columns represent the nodes.
- Each cell at the intersection of a row and a column tells you if there's a connection between those two nodes.

Imagine you have a small network of nodes and links — you can represent it either as a visual graph or as an adjacency matrix.

<img src='./assets/images/simple-matrix.png' width='1000'>

In the image above, you can see that nodes **A** and **B** are **connected**, so there is a **1** at the intersection of A and B in the matrix. Nodes **B** and **C** are **not connected**, which is why there is a **0** there — no link between them.

<img src='./assets/images/simple-matrix-colored.png' width='1000'>

Here, notice two important things:

- The **green and blue areas are symmetrical**. This happens because in this example, **links don't have a direction**: a link from A to B is the same as from B to A.
- The **yellow diagonal** represents links from a node to itself. In this case, the diagonal is all 0s, meaning there are no **self-connections** (nodes are not linked to themselves).

<img src='./assets/images/simple-matrix-loop.png' width='1000'>

On the above image you can see a graph where the C node has an **autoconnection** and its correspongding adjacency matrix. The autoconnection is on the diagonal highlighted with orange. **In our study, nodes can have autonnections**.

## Weighted adjacency matrices

Sometimes, connections aren't just about being present or absent — they can have different **weights**. In that case, the matrix shows **numbers instead of just 1s and 0s.**

<img src='./assets//images/weighted-matrix.png' width='1000'>

In the image above, you can see that the connection value between **B and C (5) is higher than the value between A and B (1)**. The meaning of these numbers — whether they represent strength, frequency, cost, or something else — depends on the network being analyzed.

As we'll explain in the next section, in our case, the weight represents the cost of a flight ticket between 2 states.

## Why are adjacency matrices useful? (TO DISCUSS INCLUSION)

- Simple structure: Easy to store and analyze with computers.
- Visual clarity: When networks are very large, matrices can be cleaner than traditional node-link diagrams.

Adjacency matrices offer a clean, structured way to represent networks. Whether dealing with simple connections or more complex relationships with weights, they are a fundamental tool in data science, computer science, and many other fields.
