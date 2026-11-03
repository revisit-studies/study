### Your results

| Country | Your answer | Correct answer |     |
| ------- | ----------- | -------------- | --- |
{{#each REVISIT.answers}}
{{#if (lookupCorrectAnswer @index 'capital-answer')}}
| {{lookupParameters @index 'flag'}} {{lookupParameters @index 'country'}} | {{lookupAnswers @index 'capital-answer'}} | {{lookupCorrectAnswer @index 'capital-answer'}} | {{#ifEquals (lookupAnswers @index 'capital-answer') (lookupCorrectAnswer @index 'capital-answer')}}✅{{else}}❌{{/ifEquals}} |
{{/if}}
{{/each}}

The table loops over every step with `\{{#each REVISIT.answers}}` and keeps the steps that have a `correctAnswer`. For each one, `lookupParameters` gives its country and flag, `lookupAnswers` your answer, and `lookupCorrectAnswer` the component's `correctAnswer`.

## Shared budget result

Remaining budget: **{{globalVariables.budget}}**. Participant label: **{{globalVariables.participantLabel}}**.

The Markdown, React, and HTML components all read and update the same participant-wide budget.
