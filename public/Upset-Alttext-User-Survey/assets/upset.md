**Please review the following introduction carefully. You will need to understand the concepts to complete this study.**

# What Is UpSet?

UpSet visualizes set data, as it would be usually displayed in a Venn diagram. However, unlike Venn diagrams, UpSet works for more than three sets. 


## UpSet Explained

UpSet plots the intersections of a set as a matrix, as shown in the following figure. **Each column corresponds to a set, and bar charts on top show the size of the set. Each row corresponds to an intersection: the filled-in cells show which set is part of an intersection.** Also notice the lines connecting the filled-in cells: they show in which direction you should read the plot: 

<img style="width: 350px; height: 400px" class="centered-image" src="./assets/concept_1_matrix.svg" alt="Explaining the matrix approach in UpSet.">

<br>

Below you can see examples of how these intersections correspond to the segments in a Venn diagram. The first row in the figure is completely empty – it corresponds to all the elements that are in none of the sets. The green (third) row corresponds to the elements that are only in set B, (not in A or C). The orange (fifth) row represents elements that are shared by sets A and B, but not with C. Finally, the last (violet) row represents the elements shared between all sets. 

<img style="height: 400px; width: 490.5px" class="centered-image" src="./assets/concept_2_intersections.svg" alt="Explaining the intersections in UpSet">

<br>

This layout is great because we can plot the size of the intersections as bar charts right next ot the matrix, as you can see in the following example: 

<img style="height: 400px; width: 531.8px" class="centered-image" src="./assets/concept_3_cardinality.svg" alt="Plotting intersection sizes with bars in UpSet.">
<br> 

This makes the size of intersections easy to compare. 

The matrix is also very useful because it can be sorted in various ways. A common way is to sort by size, as shown in the following figure, but it's also possible to sort by degree, or sets, or any other desired sorting. 

<img style="height: 400px; width: 298.4px" class="centered-image" src="./assets/concept_4_sorting.svg" alt="Sorting by cardinality in UpSet">


These are the basiscs of UpSet! Next, we'll look at an example like you will see in the study. 
 
## Interpreting UpSet Plots

The following UpSet plot shows movie genres as intersecting sets. 

<img src="./assets/upset.png" alt="A simple UpSet Example" width="500"/>
<br>

### Sets and Set Sizes: 
In this UpSet plot the genres Drama, Comedy, Thrillar, Crime, and Fantasy are the sets. The bars on top indicate that Drama is a large set, but Fantasy is small. 

In the study, **you will be asked to classify this distribution** using your judgement. Are they: 
 * Roughly equal, 
 * Diverging a bit, or 
 * Diverging a lot. 
 
 For this example the correct answer is "Diverging a lot". 


### Intersection and Intersection Sizes:
In this UpSet plot, there are 20 intersections that are made up of different sets.

You will be asked about the make-up of these intersection. The categories are
* an intersection is made up of **no set**; as shown in the third row with size 854 here (movies that don't have any of the genres shown).
* an intersection can only contains a **single set**, like the largest one (Drama, with 1198 movies)
* an can contains **2-3 sets**, like the "Drama-Comedy" intersection with size 212.
* an intersection can be made up of more than 3 sets, or **many sets
* Finally, an intersection can contain all sets, which we call an "all-set intersection" (not shown in this example). 

<br>
<br>

**This is it for the introduction. You can always come back to this guide via the Help button at the top right.**