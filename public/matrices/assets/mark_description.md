## THIRD KEY CONCEPT: Encoding

As you might notice, if the network grows it will be very difficult to read the values on a graph or on the presented adjacency matrices. We have developed a way of encoding mean and variation to visualize this kind of networks.

##### Color encodes the mean:

Each cell in the matrix will have a color:

- If the color is light, the mean flight price is low.
- If the color is dark, the mean flight price is high.

So, lighter = cheaper and darker = more expensive.

<img src='./assets/images/color-mean.svg' width='500'>

##### Mark size encodes the variation.

Inside each cell, there will be a white square mark:

- A tiny mark means prices are very stable (they don't change much).
- A big mark means prices are all over the place (they change a lot!).

So, small mark = consistent prices, big mark = unpredictable prices.

<img src='./assets/images/size-std.svg' width='500'>

Let's do some training exercises!
