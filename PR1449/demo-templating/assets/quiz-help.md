### Need help?

You're answering about **{{country}}**, in {{continent}}.

{{#if (lookupAnswersRel -1 'capital-answer')}}
On the previous question you answered **"{{lookupAnswersRel -1 'capital-answer'}}"**.
{{else}}
This is your first capital-city question — there's no previous answer to reference yet.
{{/if}}

All of your answers in one place:

| Country | Your answer | Correct answer |     |
| ------- | ----------- | -------------- | --- |
{{#each REVISIT.answers}}
{{#if (lookupCorrectAnswer @index 'capital-answer')}}
| {{lookupParameters @index 'flag'}} {{lookupParameters @index 'country'}} | {{#if (lookupAnswers @index 'capital-answer')}}{{lookupAnswers @index 'capital-answer'}} | {{lookupCorrectAnswer @index 'capital-answer'}} | {{#ifEquals (lookupAnswers @index 'capital-answer') (lookupCorrectAnswer @index 'capital-answer')}}✅{{else}}❌{{/ifEquals}}{{else}}— | — | —{{/if}} |
{{/if}}
{{/each}}

This help text comes from the `helpTextPath` of the `markdown-template-quiz` and `html-template-quiz` components, and is run through Handlebars just like markdown stimuli. The correct answers come from each component's `correctAnswer`.
