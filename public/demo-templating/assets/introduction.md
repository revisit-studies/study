This is a demo of reVISit's Handlebars templating feature. It lets you write `{{variable}}` placeholders in a component's config and fill them in from a `parameters` object, so you can reuse the same component definition for many trials that only differ by data.

In this study, every trial is a "guess the capital" question reusing a single `quizQuestion` base component. Each trial's `parameters` (country, continent, hint file, fun fact, hint level) are substituted into:

- the `instruction` text
- the `path` used to pick which hint markdown file to load
- the **content** of that hint markdown file itself, including a `{{#ifEquals}}...{{else ifEquals}}...{{else}}...{{/ifEquals}}` chain that picks which hint wording to show based on the `hintLevel` parameter
- the response `prompt`, `secondaryText`, and `infoText`

## Relevant files:

- [The Config](https://github.com/revisit-studies/study/blob/main/public/demo-templating/config.json)
- [hint-europe.md](https://github.com/revisit-studies/study/blob/main/public/demo-templating/assets/hint-europe.md)

## Relevant documentation:

- [Designing Studies](https://revisit.dev/docs/designing-studies/)
