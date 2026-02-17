# Note
We did not choose to replicate the Cleveland and McGill study. We checked our study with Professor Harrison and got confirmation that our study would be ok to replicate. Additionally, this assignment is an extension of our MQP team which consists of the members of this team (Zoe Fisk, Skyler Lin, Morgan Vasiliou) and another student from this CS4804 class, Zach Medailleu. Zach contributed to the technical achievements of this assignment.

# Background
In 2022, Liu et al. published a paper exploring how various contextual cues influence digital health information for younger vs. older adults using eye-tracking (https://doi.org/10.3390/su142416506). This study explored a visualization type called reference range number lines (RRNLs), which are a variant of number lines where an exact value is indicated along a scale and categorical ranges are visually indicated along that scale.

The variables for this study were age and visualization type. Age was classified into younger (age 18-40 years old) and older (60+ years old). Visualization types were classified as A, B, C, and D where each subsequent visualization added another contextual cue from the previous one.

** INSERT IMAGE FROM STUDY OF THE FOUR VIS TYPES **

In the original study, participants were shown a RRNL showing blood glucose or blood pressure values and were asked to indicate the exact value being shown on the number line and whether or not that value fell within normal ranges. The accuracy and time of task completion was measured, as were eye-tracking measures such as time to first fixation. Because of convenience sampling constraints, we were not able to collect data on older adults. Additionally, we were not able to use eye-tracking measres because of equipment constraints. Our project isntead focuses on replicating the accuracy and time of completion results for all visualization types for younger adults.

# Our study
We recreated each of the visualization types for both normal and abnormal blood glucose and blood pressure conditions as done in the original study.

** INSERT IMAGE OF ONE OF OUR BLOOD PRESSURE GRAPHS **
** INSERT IMAGE OF ONE OF OUR BLOOD GLUCOSE GRAPHS **

This amassed to 16 total visualizations: 4 vis types x 2 possibilities for normal x 2 test measures.

In our study, participants were shown one of the 16 visualizations and asked 4 questions: 2 asking for the exact value and 2 asking for value interpretation. For example, a blood pressure visualization including both systolic and diastolic values would be accompanied by these 4 questions:

1. What is the systolic value?
2. What is the diastolic value?
3. Is the systolic value normal?
4. Is the diastolic value normal?

The time it took to complete the four questions was recorded. The participant completed this task with 8 different visualizations then was given a 5 minutes break, and completed the last 8 visualizations. The visualizations were shown in random order. At the end of the study, the participant was shown the percentage they got correct.

# Data Analysis
We replicated the dat aanalysis for all visualizations types and younger adults for this study. This included Table 1 and Figure 3 in the study. Our results are as follows:

Figure X: Task completion time and accuracy rate by visualizations and age.

** INSERT OUR FINAL TABLE HERE **

Table X: Interaction effects of visualization on accuracy rate and task completion for verbatim (a and b) and value interpretation task (c and d). Error bars show standard errors.

** INSERT OUR FINAL FIGURE HERE **

** DO SOME ANALYSIS ON WHETHER OR NOT WE REPLICATED The STUDY **

# Technical Achievements


# Design Achievements


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
