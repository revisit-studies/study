# Revisit.postAnswers

Send the current answers from an HTML stimulus to its containing reVISit study. This method is provided by `revisit-communicate.js` as `window.Revisit.postAnswers`.

```js
Revisit.postAnswers({ selection: "A", confidence: 4 });
```

## Parameters and Return Value

`answers` is a JSON-serializable object whose keys are the IDs of the stimulus's reactive responses and whose values are their current answers. The method returns `undefined`; it is not a promise or an acknowledgement that data has been persisted.

Each call replaces the communication helper's latest payload, including any payload queued during restoration. Send every current reactive answer together so that a later call cannot discard an earlier queued field. Once an answer has reached the host, reactive values are merged by response ID: omitting an ID does not delete its previously accepted value, and posting `{}` does not clear the answers. Response IDs owned by built-in form inputs are not overwritten by messages from the stimulus.

Posting an answer does not advance the study or force a database save. Normal response validation and trial submission still apply.

## Example

Declare a reactive response on the website component in the Study Config:

```json
{
  "type": "website",
  "path": "my-study/assets/choice.html",
  "response": [{ "id": "selection", "prompt": "Your answer", "type": "reactive" }]
}
```

In `my-study/assets/choice.html`, load the communication script before calling the API. Adjust the relative script path if the HTML file is stored elsewhere.

```html
<script src="../../revisitUtilities/revisit-communicate.js"></script>
<label>
  Your answer
  <input id="selection" type="text">
</label>
<script>
  const input = document.getElementById("selection");

  Revisit.onRestore(({ answers }) => {
    input.value = answers.selection ?? "";
  });

  input.addEventListener("input", () => {
    Revisit.postAnswers({ selection: input.value });
  });

  Revisit.completeRegistration();
</script>
```

## Restoration and Replay

Use `Revisit.onRestore` to restore the HTML controls from saved answers before accepting new input. Do not publish default answers over restored participant answers. When registration or restoration is pending, the communication script queues the latest answer object until restoration completes.

In analysis/replay mode, answer publication is disabled so replay cannot modify participant answers. Answer publication is separate from provenance recording; use `Revisit.createTrrack` when the stimulus also needs recorded interaction history.

Call `Revisit.completeRegistration()` after registering the restoration handlers and managed Trrack instances, even when initialization is synchronous as in this example. Until registration is complete, restoration does not run and new answers remain queued. For asynchronous initialization, also call `Revisit.beginRegistration()` before starting that work.
