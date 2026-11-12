### Your results

| Country | Your answer | Correct answer |     |
| ------- | ----------- | -------------- | --- |
{{#each REVISIT.answers}}
{{#if (lookupCorrectAnswer @index 'capital-answer')}}
| {{lookupParameters @index 'flag'}} {{lookupParameters @index 'country'}} | {{lookupAnswers @index 'capital-answer'}} | {{lookupCorrectAnswer @index 'capital-answer'}} | {{#ifEquals (lookupAnswers @index 'capital-answer') (lookupCorrectAnswer @index 'capital-answer')}}✅{{else}}❌{{/ifEquals}} |
{{/if}}
{{/each}}

The table loops over every step with `\{{#each REVISIT.answers}}` and keeps the steps that have a `correctAnswer`. For each one, `lookupParameters` gives its country and flag, `lookupAnswers` your answer, and `lookupCorrectAnswer` the component's `correctAnswer`.
