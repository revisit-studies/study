# Section 1: The Landscape View

When you first open the Grasp Explorer, you see a **scatter plot** where each dot represents one of 56 grasp planning methods. Methods that are similar (based on their planning approach, gripper type, sensor input, and other attributes) appear close together.

The methods are **projected** across all text+categorical features using _UMAP_ and subsequently grouped into **clusters** using _HDBSCAN_, a density-based clustering algorithm. Each cluster is labeled by its dominant characteristics (e.g., "Sampling / Two-finger / Piled").

## Interactive Cluster Filtering

The cluster legend on the left is **clickable**. Click a cluster label to highlight only those methods in the scatter plot and the table below. Click again to clear the filter.

## What to look for

- Do the clusters make sense to you as a domain expert?
- Can you identify which methods are in which group?
- Does the spatial layout (which methods are near or far from each other) match your intuition?
- Is there anything surprising about how methods are grouped?
- Try clicking a cluster in the legend — does filtering the view this way feel natural?

## Heads up: what we will ask after you explore

You will **not** be able to interact with the tool while answering feedback questions, so keep these in mind as you explore:

- Did the clusters make sense? Were any groupings surprising or missing?
- Did the spatial layout match your intuition about which methods are similar?
- Were the cluster labels clear?
- What attributes matter most to you when deciding if two methods are "similar"?

## Think aloud

Please **speak your thoughts out loud** as you explore. We are recording your screen and audio to understand your experience.

Click **Next** to explore the scatter plot.
