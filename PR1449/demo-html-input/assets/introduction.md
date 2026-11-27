This is an example study to show how to embed HTML elements into the study page.
In this example, the HTML stimulus communicates with the reVISit study framework to save the clicked bar as the answer, which is also stored in the study provenance.

The first two trials let you select a bar and continue with Next. In the final trial, clicking any bar records its value and automatically continues after 300 milliseconds using `Revisit.postAnswers(answers, true, 300)`.
The trial's `parameters` enable this behavior, and `nextButtonHidden` hides Next.

## Relevant files:
 * [The Config](https://github.com/revisit-studies/study/blob/main/public/demo-html-input/config.json)
 * [bar-chart-interaction.html](https://github.com/revisit-studies/study/blob/main/public/demo-html-input/assets/bar-chart-interaction.html)

## Relevant documentation:
 * [Designing HTML Stimuli](https://revisit.dev/docs/designing-studies/html-stimulus/)
