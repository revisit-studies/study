This is a demo of reVISit's Handlebars templating feature. It lets you write `\{{variable}}` placeholders in a component's config and fill them in from a `parameters` object, so you can reuse the same component definition for many trials that only differ by data.

In this study, every trial is a "guess the capital" question reusing a single `quizQuestion` base component. Each trial's `parameters` (country, continent, hint file, fun fact, hint level) are substituted into:

- the `instruction` text
- the `path` used to pick which hint markdown file to load
- the **content** of that hint markdown file itself, including a `\{{#ifEquals}}...\{{else ifEquals}}...\{{else}}...\{{/ifEquals}}` chain that picks which hint wording to show based on the `hintLevel` parameter
- the response `prompt`, `secondaryText`, and `infoText`
- the trial's `helpTextPath` markdown (opened via the "?" help button), which is templated exactly like a markdown stimulus

On top of plain variable substitution, there are two helpers for reading another trial's answer:

- `lookupAnswersRel offset responseId` looks up an answer **relative** to the current trial — `lookupAnswersRel -1 "capital-answer"` reads the `capital-answer` response from the trial one step back, `-2` two steps back, and so on.
- `lookupAnswers index responseId` looks up an answer by its **absolute** position in the study sequence — `lookupAnswers 1 "capital-answer"` always reads quiz 1's answer, regardless of which trial is currently showing. Like Python list indexing, negative indices count from the end: `lookupAnswers -1 "capital-answer"` reads the **last** trial in the sequence, `-2` the second-to-last, etc.

Both are commonly paired with `ifEquals` (`\{{#ifEquals (lookupAnswersRel -1 "capital-answer") "Paris"}}...\{{/ifEquals}}`) to branch on a prior answer, or with `if` (`\{{#if (lookupAnswersRel -1 "capital-answer")}}...\{{/if}}`) to only show something when that answer exists.

## Relevant files:

- [The Config](https://github.com/revisit-studies/study/blob/main/public/demo-templating/config.json)
- [hint-europe.md](https://github.com/revisit-studies/study/blob/main/public/demo-templating/assets/hint-europe.md)
- [quiz-help.md](https://github.com/revisit-studies/study/blob/main/public/demo-templating/assets/quiz-help.md)

## Relevant documentation:

- [Designing Studies](https://revisit.dev/docs/designing-studies/)
