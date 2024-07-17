# Help

<!-- This is a questionnaire. For each question, be sure to provide and answer and then click **Next** when you’re ready to move onto the next question. -->

# What Is UpSet?

The major challenge in understanding relationships between sets is the combinatorial explosion of the number of set intersections if the number of sets exceeds a trivial threshold. The most common set visualization approach – Venn Diagrams – doesn't scale beyond three or four sets. **UpSet, in contrast, is well suited for the quantitative analysis of data with more than three sets.** 

UpSet visualizes set intersections in a matrix layout. The matrix layout enables the effective representation of associated data, such as the number of elements in the intersections.
 

## UpSet Explained

UpSet plots the intersections of a set as a matrix, as shown in the following figure. Each column corresponds to a set, and bar charts on top show the size of the set. Each row corresponds to a possible intersection: the filled-in cells show which set is part of an intersection. Also notice the lines connecting the filled-in cells: they show in which direction you should read the plot: 

<img style="width: 350px; height: 400px" class="centered-image" src="./assets/concept_1_matrix.svg" alt="Explaining the matrix approach in UpSet.">

Here you can see examples of how these intersections correspond to the segments in a Venn diagram. The first row in the figure is completely empty – it corresponds to all the elements that are in none of the sets. The green (third) row corresponds to the elements that are only in set B, (not in A or C). The orange (fifth) row represents elements that are shared by sets A and B, but not with C. Finally, the last (violet) row represents the elements shared between all sets. 

<img style="height: 400px; width: 490.5px" class="centered-image" src="./assets/concept_2_intersections.svg" alt="Explaining the intersections in UpSet">

This layout is great because we can plot the size of the intersections (the “cardinality”) as bar charts right next ot the matrix, as you can see in the following example: 

<img style="height: 400px; width: 531.8px" class="centered-image" src="./assets/concept_3_cardinality.svg" alt="Plotting intersection sizes with bars in UpSet.">

This makes the size of intersections easy to compare. 

The matrix is also very useful because it can be sorted in various ways. A common way is to sort by the cardinality (size), as shown in the following figure, but it's also possible to sort by degree, or sets, or any other desired sorting. 

<img style="height: 400px; width: 298.4px" class="centered-image" src="./assets/concept_4_sorting.svg" alt="Sorting by cardinality in UpSet">


These are the basiscs of UpSet! There's a lot more than you can do with UpSet plots, such as visualize attributes of the intersections, or group intersections. Look at the [upset.multinet.app](https://upset.multinet.app/) for details.
 
## Interpreting UpSet Plots

UpSet Plots are generally easy to read. Look at the following UpSet plot that presents movie genres as intersecting sets. 

<img src="./assets/upset.png" alt="A simple UpSet Example" width="500"/>


### Sets and Set Sizes: 
In this UpSet plot, Drama, Comedy, Thrillar, Crime, Fantasy are the movie genres (sets) that is repreented in five columns and the bars correspondent to their sizes. For tis particular example, the set sizes are sorted in descending order, but usually they can be of any order. The largest set is "Drama" and the smallest set is "Fantasy". With naked eye, we can easily say that the difference between the largest and the smallest set is quite significant. Based on this difference, we classify them in three types : Roughly equal, Diverging a bit, Diverging a lot. For this example, it is "Diverging a lot". 

### Intersection and Intersection Sizes:
In this UpSet plot, there are 20 intersections in 20 different rows. Based on the number of sets present in each intersection, we classify them in three parts. If the intersection only contains one set, then it is made of single sets. If the intersection contains 2-3 sets, then it is called made of 2-3 sets. If more than 3 sets, then it is called made of many sets. Sometimes a intersection can have no set at all, and we name it as "the empty intersection". Another variant is, suppose the plot has five intersecting sets present and an intersection contains all of them, we name it as "all-set intersection". For the above example, there is no intersection having all the five sets, and the third row is empty intersection. There are bars for corresponding rows that show intersection sizes. Intersection sizes can be shown in any order. For above example, it is in descending order and the largest intersection contains single set (Drama). An example of intersection containing two sets is row six (Drama and Thrillar), and an example of intersection having three sets is row 20 (Comedy, Crime and Fantasy).
