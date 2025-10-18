
# nasa-tlx



This is an example study of the library `nasa-tlx`.

The NASA-TLX is a widely used subjective workload assessment tool. It consists of six subscales: Mental Demand, Physical Demand, Temporal Demand, Performance, Effort, and Frustration. The NASA-TLX is designed to assess the perceived workload of a task and is commonly used in human factors and ergonomics research. We provide a component of the NASA-TLX itself, and a sequence that includes a source of load evaluation. The source of load evaluation is based on the pairwise weighting procedure described in the NASA-TLX manual.

## Reference

Hart, Sandra G., and Lowell E. Staveland. "Development of NASA-TLX (Task Load Index): Results of empirical and theoretical research." Advances in psychology. Vol. 52. North-Holland, 1988. 139-183.

DOI: [10.1016/S0166-4115(08)62386-9](https://dx.doi.org/10.1016/S0166-4115(08)62386-9)



## Available Components

- nasa-tlx
- source-of-load

## Available Sequences

- nasa-tlx-with-source-of-load-evaluation

## Additional Description

### Source of Workload Evaluation (Pairwise Weighting Procedure)

Reference: [NASA TLX manual](https://ntrs.nasa.gov/api/citations/20000021488/downloads/20000021488.pdf) (Section 2.2)

This step of the NASA-TLX assesses the relative importance of different factors that contribute to a person's experience of workload during a task. Rather than assuming all workload components are equally important, this procedure captures individual differences in how workload is perceived.

Participants are presented with 15 pairwise comparisons between the six NASA-TLX subscales:

- Mental Demand
- Physical Demand
- Temporal Demand
- Performance
- Effort
- Frustration

For each pair, participants are asked to select the factor that contributed more to their workload experience in the given task.

#### How It Works
Each chosen subscale earns one point (a "tally mark").

After 15 comparisons, each subscale has a weight from 0 to 5.

These weights reflect the participant's personal weighting of each workload dimension.

#### How to Use the Result
After task performance, participants also rate the magnitude (0–100) of each of the six subscales.

For each subscale:
Adjusted Score = Raw Rating × Weight

The overall workload score is calculated by summing all adjusted scores and dividing by 15:
Overall Workload = Σ(Adjusted Scores) ÷ 15

This weighted workload score accounts for both perceived intensity and individual prioritization, improving sensitivity and personalization in workload analysis.
