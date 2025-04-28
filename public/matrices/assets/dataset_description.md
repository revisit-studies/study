## What data we will use? Flight mean prices and variations across EEUU states.

In this study, we want to show two important things about flight prices between each pair of U.S. states:

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

We can think about the price "range" like: **Mean ± Standard Deviation**

For example, if:

- Mean = $100
- Standard Deviation = $20

It means most flights are between $80 and $120. Like in the image bellow if you flight from A to B (or from B to A).

<img src='./assets/images/price-matrix.png' width='500'>

<br>

Let's take a closer look at the image above to understand it better.

Flying from B to C or B to D costs about the same on average.
But if you look carefully, you'll see something important:

- When flying to D, prices can change a lot — they can be $80 cheaper or $80 more expensive than the average. That means you might find a ticket for $70 or even $230!
- When flying to C, prices are much more stable — they only go up or down by about $5.

Personally, I would prefer flying to C, because the prices are much more predictable and you won’t get any big surprises.

## This is complex

We know this might feel a bit tricky at first.

Take your time — understanding these ideas is important, and there's no rush!
