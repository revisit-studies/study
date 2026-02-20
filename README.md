Members: Zoe Fisk, Skyler Lin, Morgan Vasiliou

# Note
We did not choose to replicate the Cleveland and McGill study and instead chose another study to replicate. We checked our study with Professor Harrison and got confirmation that our study would be ok to replicate. Additionally, the visualization type we chose to replicate is a part of our MQP. Our MQP team consists of the members of this team (Zoe Fisk, Skyler Lin, Morgan Vasiliou) and another student from this CS4804 class, Zach Medailleu. Zach contributed to the technical achievements of this assignment.

# Original Study
In 2022, Liu et al. published a paper exploring how various contextual cues influence digital health information for younger vs. older adults using eye-tracking (https://doi.org/10.3390/su142416506). This study explored a visualization type called reference range number lines (RRNLs), which are a variant of number lines where an exact value is indicated along a scale and categorical ranges are visually noted along that scale (e.g., normal and abnormal ranges).

The variables for this study were age and visualization type. Age was classified into younger (age 18-40 years old) and older (60+ years old). Visualization types were classified as A, B, C, and D where each subsequent visualization added another contextual cue from the previous one. A was a RRNL with no color, B was the same visualization with colored reference ranges, C was the same as Vis B but included category labels (low, normal, high), and D was the same as C but included a speech bubble to indicate the average value for the participants age.

Figure 1: Original image of all stimuli from the study
** INSERT IMAGE FROM STUDY OF THE FOUR VIS TYPES **

In the original study, participants were shown a RRNL showing blood glucose or blood pressure values and were asked to indicate the exact value being shown on the number line and whether or not that value fell within normal ranges. The accuracy and time of task completion were measured, as were eye-tracking measures such as time to first fixation. Because of convenience sampling constraints, we were not able to collect data on older adults (60+) and only collected data for young adults (18-40). Additionally, we were not able to use eye-tracking measures because of equipment constraints. Our project instead focuses on replicating the accuracy and time of completion results for all visualization types for younger adults.

# Our study
We recreated each of the visualization types for both normal and abnormal results of blood glucose and blood pressure conditions as done in the original study.

Figure 2: Our replicated visualizations using Vega.
** Insert picture of each of our vis types **

This amassed to 16 total visualizations: 4 vis types x 2 possibilities for normal x 2 test measures.

In our study, participants were shown one of the 16 visualizations and asked 4 questions: 2 asking for the exact value of each number line and 2 asking for value interpretation of each value. For example, a blood pressure visualization including both systolic and diastolic values would be accompanied by these 4 questions:

1. What is the systolic value?
2. What is the diastolic value?
3. Is the systolic value normal?
4. Is the diastolic value normal?

The time it took to complete the four questions was recorded. The participant completed this task with 8 different visualizations then was given a 2 minutes break, and completed the last 8 visualizations. The visualizations were shown in random order. At the end of the study, the participant was which questions they got correct.

## Data Analysis
We replicated the data analysis for all visualizations types and younger adults for this study with one limitation. Because of how our ReVisit study was designed, we did not have different task completion times for the two different question types. Instead, we collected the task completion time for each set of questions and plotted that against the vis types to highlight any trends. With this limitation in mind, we tried our best to replicate Table 1 (Task completion time and accuracy rate by visualizations and age.) and Figure 3 (Interaction effects of visualization and age on accuracy rate and task completion time for the verbatim comprehension task and the value interpretation task.) Our results are as follows:

Table 1: Interaction effects of visualization on accuracy rate and task completion.

** INSERT OUR FINAL TABLE HERE **

Figure 3: Accuracy rate and task completion time by visualizations. Error bars show standard errors.

** INSERT OUR FINAL FIGURE(S) HERE **

## Brief Analysis of our Results

** DO SOME ANALYSIS ON WHETHER OR NOT WE REPLICATED The STUDY **

# Technical Achievements
- Manually designed a ReVisit page that included a manditory break time.
- Manually designed a ReVisit page that showed each question answered and whether the participant got the answer correct or incorrect.

# Design Achievements
- Replicated the orientation of the arrow in each of the RRNLs (on top of the number line pointing down at the value).
- Replicated the speech bubble design of Vis type D for each graph.
- Visual design of the ReVisit page that showed each question and the participant's accuracy.


# START ORIGINAL README
# reVISit study – Interactive, Web-Based User Studies.  

Create your own interactive, web-based data visualization user studies by cloning/forking and editing configuration files and adding stimuli in the `public` folder. 

reVISit introduces reVISit.spec a DSL for specifying study setups (consent forms, training, trials, etc) for interactive web based studies. You describe your experimental setup in reVISit.spec, add your stimuli as images, forms, html pages, or React components, build and deploy – and you're ready to run your study. For tutorials and documentation, see the [reVISit website](https://revisit.dev). 

## Build Instructions

To run this demo experiment locally, you will need to install node on your computer. 

* Clone `https://github.com/revisit-studies/study`
* Run `yarn install`. If you don't have yarn installed, run `npm i -g yarn`. 
* To run locally, run `yarn serve`.
* Go to [http://localhost:8080](http://localhost:8080) to view it in your browser. The page will reload when you make changes. 

## Release Instructions

Releasing reVISit.dev happens automatically when a PR is merged into the `main` branch. The name of the pull request should be the title of the release, e.g. `v1.0.0`. Releasing creates a tag with the same name as the PR, but the official GitGub release should be created manually. The `main` branch is protected and requires two reviews before merging.

The workflow for release looks as follows:
Develop features on feature branch
| PRs
Dev branch
| PR (1 per release)
Main branch
| Run release workflow on merge
References are updated and commit is tagged
