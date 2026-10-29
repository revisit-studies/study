This demo shows reVISit's Handlebars templating: write `\{{variable}}` placeholders in a component's config or files and fill them from its `parameters`, so one definition can serve many trials that differ only by data.

There are two "guess the capital" questions, one markdown and one HTML, followed by Markdown, React, and HTML global-budget examples and a summary. Each question's `parameters` (`country`, `continent`, `funFact`, `flag`, plus `hintFile` or `cityOptions`) are substituted into:

- the `instruction`, and the markdown question's response `prompt`, `secondaryText`, and `infoText`
- the markdown question's `path` (`hintFile` picks the hint file) and that file's content
- the HTML page's content, because the website component sets `templated: true`
- the `helpTextPath` markdown behind the "?" Help button, whose table uses the helpers below

Helpers read data from other steps:

| Helper | Reads |
|---|---|
| `lookupAnswers` / `lookupAnswersRel` | the participant's answer |
| `lookupParameters` / `lookupParametersRel` | that step's `parameters` |
| `lookupCorrectAnswer` / `lookupCorrectAnswerRel` | that component's `correctAnswer` |

Each takes a position, then a key. `Rel` positions are **relative** to the current step: `lookupAnswersRel -1 "capital-answer"` reads the previous step, `-2` two back. Plain positions are **absolute**: `lookupAnswers 1 "capital-answer"` always reads step 1, the markdown question, and negative values count from the end like Python (`-1` is the last step).

Pair them with `if` to show something only when a value exists (`\{{#if (lookupAnswersRel -1 "capital-answer")}}…\{{/if}}`), or with `ifEquals` to branch on it (`\{{#ifEquals (lookupAnswersRel -1 "capital-answer") (lookupCorrectAnswerRel -1 "capital-answer")}}correct\{{else}}incorrect\{{/ifEquals}}`).

## Relevant files:

- [The Config](https://github.com/revisit-studies/study/blob/main/public/demo-templating/config.json)
- [hint-europe.md](https://github.com/revisit-studies/study/blob/main/public/demo-templating/assets/hint-europe.md)
- [quiz-help.md](https://github.com/revisit-studies/study/blob/main/public/demo-templating/assets/quiz-help.md)
- [capital-picker.html](https://github.com/revisit-studies/study/blob/main/public/demo-templating/assets/capital-picker.html)
- [global-budget.md](https://github.com/revisit-studies/study/blob/main/public/demo-templating/assets/global-budget.md)
- [GlobalBudget.tsx](https://github.com/revisit-studies/study/blob/main/src/public/demo-templating/assets/GlobalBudget.tsx)
- [global-budget.html](https://github.com/revisit-studies/study/blob/main/public/demo-templating/assets/global-budget.html)
- [summary.md](https://github.com/revisit-studies/study/blob/main/public/demo-templating/assets/summary.md)

## Relevant documentation:

- [Designing Studies](https://revisit.dev/docs/designing-studies/)

## Participant global variables

The config declares `"globalVariables": {"budget": 100}`. An expanded declaration can add the same text validation and length rules used by responses; see `participantLabel` in the config.

The budget examples show access **inside each component**: Markdown content uses `\{{globalVariables.budget}}`, React renders `globalVariables.budget` from the stimulus `globalVariables` prop, and HTML reads the same snapshot with `Revisit.onGlobalVariablesReceive`. The HTML example also shows the value directly in templated markup.

Markdown subtracts its numeric response through `onSubmit`. React and HTML register an updater. Each page shows its entry budget; spending commits only when Next succeeds. Previous restores that entry snapshot, and resubmitting unchanged does not spend twice.
