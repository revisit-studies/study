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

## What data will we use? Flight mean prices and variations across United States.

In this study, we want to show two important things about flight prices between each pair of states:

- What is the **average price** of a flight between two states (this is called the **mean**).
- How much those prices **change or jump around** (this is called the **variation**, and we measure it with something called **standard deviation**).

## What do "mean" and "variation" mean?

The **mean** is very simple: it’s just the **usual price** you would expect.

Imagine you took several flights between California and Texas.
One flight cost $100, another $120, another $80.
If you add them up and divide by how many flights you had, you get the mean — **the "typical" price.**

But wait — not every flight costs exactly the same!

Variation tells us how much the prices change from the typical price.

**Low standard deviation:** Prices are similar and stable.

**High standard deviation:** Prices jump all over the place — sometimes cheap, sometimes expensive.

## Example:

Suppose: Average (mean) flight price between two states = $100.

- If the **variation is low**, most flights cost something like **$95, $100, $105.**
- If the **variation is high**, some flights cost **$50, some $100, some $150!**

So even if two pairs of states have the **same average price**, one might be very **predictable** and the other very **unpredictable.**

## How do we show this with a matrix?

In our adjacency matrix we can add this information:

- Each cell shows the average flight price between two states.
- And we can also show how stable or unstable those prices are by using the standard deviation.

We can think about the price "range" as: **Mean ± Standard Deviation**, which gives a rough idea of where most prices fall.

For example, if:

- Mean = $100
- Standard Deviation = $20

**A majority flights** (assuming a roughly normal distribution) are **between $80 and $120**. Like in the image bellow if you flight from A to B (or from B to A).

<img src='./assets/images/price-matrix.png' width='500'>

<br>

Let's take a closer look at the image above to understand it better.

Flying from B to C or B to D costs about the same on average. But if you look carefully, you'll see something important:

- When flying to D, prices tend to vary a lot — about $80 above or below the average. So while the average ticket might be $150, you’ll often find prices as low as $70 or as high as $230. That range reflects typical fluctuations, not extreme cases.
- In contrast, prices for flights to C are much more consistent — usually within $5 of the average. So if the average price is $150, most tickets will be between $145 and $155.

Personally, I would prefer flying to C, because the prices are much more predictable and you won’t get any big surprises.
