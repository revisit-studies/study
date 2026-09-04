### Need help?

You're answering about **{{country}}**, in {{continent}}.

{{#if (lookupAnswersRel -1 'capital-answer')}}
On the previous question you answered **"{{lookupAnswersRel -1 'capital-answer'}}"**.
{{else}}
This is your first capital-city question — there's no previous answer to reference yet.
{{/if}}

All of your answers in one place:
|Tasks|Identifier|Answers|
|-----|----------|-------|
{{#each REVISIT.answers}}
|TASK {{@index}}|{{this.identifier}}|{{lookupAnswers @index 'capital-answer'}}|
{{/each}}

This help text comes from the `quizQuestion` base component's own `helpTextPath`, which is also run through Handlebars, just like markdown stimuli.
