{{#ifEquals (lookupAnswersRel -1 "capital-answer") "Brasilia"}}

> _Nice — you answered "Brasilia" (the capital of Brazil) on the previous trial!_

---

{{/ifEquals}}

**Hint for this task:** {{country}} is well known for {{funFact}}.

{{#ifEquals hintLevel "direct"}}
This fun fact points straight at the capital — you can probably guess it from that alone.
{{else ifEquals hintLevel "misleading"}}
Careful: this fun fact is associated with the country as a whole, and might make you think of a different, more famous city than the actual capital.
{{else ifEquals hintLevel "obscure"}}
This capital isn't the country's most famous city — you may know a bigger city from this country better than its capital.
{{else}}
No hint level set for this trial.
{{/ifEquals}}

---
