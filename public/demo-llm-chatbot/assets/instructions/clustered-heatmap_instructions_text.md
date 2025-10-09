# Clustered Heatmap Textual Explanation

## Step 1: Introduction to the Clustered Heatmap and Chart Overview

* A **clustered heatmap** combines a heatmap and dendrograms:  
  * **Heatmap**: A matrix of squares that represent tabular data values through color saturation.  
  * **Dendrograms:** Tree-like diagrams positioned above and to the right of the heatmap, showing the similarity between rows and columns.  
* **We use an example to explain this chart type.**  
  * Imagine a  clustered heatmap that visualizes how frequently actors appear in different movie genres.   
  * Similar actors and genres are grouped together. 

## Step 2: What’s in the Heatmap

* **Rows and Columns:**  
  * **Rows represent 5 actors,** from top to bottom:  
    * Dwayne Johnson  
    * Julia Roberts  
    * Tom Hanks  
    * Jennifer Lawrence  
    * Leonardo DiCaprio  
  * **Columns represent 4 movie genres,** from left to right:  
    * Action  
    * Drama  
    * Comedy  
    * Romance  
* Each square in the matrix indicates the number of movies an actor has performed in for each genre. The color saturation represents these numbers:  
  * Darker squares: More movies in a specific genre.  
  * Lighter or blank squares: Fewer or no movies.  
* **Example:** For Dwayne Johnson (his row):  
* **Action**: Very dark (45 movies). This is the darkest square in the heatmap, representing the highest value.  
* **Drama**: Light (10 movies).  
* **Comedy**: Medium-dark (28 movies).  
* **Romance**: Blank (0 movies). This is the lowest value in the heatmap.

## Step 3: What do Dendrograms Show

* Dendrograms show hierarchical grouping based on similarity.  
* **Row Dendrogram**  
  * The row dendrogram shows similarities between actors.   
  * If rows are connected directly with a short branch it indicates that these actors are similar in terms of the movie genres they typically perform in.   
  * Clusters are groups of similar rows with close connections.  
  * This chart has two main actor clusters.  
    * **Cluster 1**: Julia Roberts and Tom Hanks  
      * Both have few Action movies.  
      * Both have many Drama and Comedy movies.  
      * Both are some Romance movies.  
    * **Cluster 2**: Jennifer Lawrence and Leonardo DiCaprio  
      * Both have many Drama movies.  
      * Both have few movies in other genres.  
  * **Outlier:** The elements deviating significantly from the main clusters are outliers.  
    * This chart has one outlier among actors.  
    * **Outlier**: Dwayne Johnson  
      * His movie genre pattern is different from other actors. For example, he is heavily involved in Action movies, while other four actors have very low numbers in this genre.  
* **Column Dendrogram**  
  * The column dendrogram shows similarities of movie genres.   
  * The principle is the same as the row dendrogram but applied to the columns. If columns group closer, it means these genres are more similar in terms of actor involvement patterns.  
  * Again, groups of similar columns can form clusters.   
* **Cluster and Outlier:**  
  * In this chart, the movie genres are clustered incrementally in a step-by-step manner, starting with closely related pairs and gradually incorporating more distinct genres. The tall tree indicates that they are generally not very similar.   
* **Romance and Comedy** group together first, indicating they are the most similar genres.  
* **Drama** joins next.  
* **Action** joins last, being the most distinct genre (outlier).

## Recap

* The heatmap displays values using a matrix of color-saturation coded squares.  
* The dendrograms reveal similarity between rows and columns.
