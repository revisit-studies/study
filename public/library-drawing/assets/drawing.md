# Drawing: Provenance-Tracked Sketching

This is a demo of the library `drawing`.

A borderless freehand drawing canvas that fills the available study area, with pen, eraser, seven ink colors, three pen sizes, clear, undo, and redo. Uses Excalidraw with reVISit's managed Trrack provenance capture for participant replay. The final scene is saved as the drawing response. Parameters: responseId (default drawing), height (optional fixed height in pixels; otherwise fills available space), initialColor (default red), initialPenSize (m, l, or xl; default m), initialDrawing (optional scene), and requireDrawing (default false).

## Reference

Link: [https://docs.excalidraw.com/](https://docs.excalidraw.com/)

## Available Components

- canvas

## Available Sequences

- drawing

## Additional Description

Import the library in the Study Config, then use the canvas component or the ready-made sequence.

```json
{
  "importedLibraries": ["drawing"],
  "components": {
    "sketch": {
      "baseComponent": "$drawing.components.canvas",
      "parameters": {
        "responseId": "drawing",
        "initialColor": "red",
        "initialPenSize": "m",
        "requireDrawing": true
      }
    }
  },
  "sequence": {
    "order": "fixed",
    "components": ["sketch"]
  }
}
```

Alternatively, include `"$drawing.sequences.drawing"` in `sequence.components` to use the default canvas without defining a local component.

The canvas fills the available study area by default. Set `height` to a fixed height in pixels. You can seed it with an Excalidraw scene using `initialDrawing`. The default `responseId` is `drawing`; if you change it, update the hidden reactive response ID in the component as well. `requireDrawing: true` requires at least one visible, nondeleted drawing element before the Participant can continue.

Participants can draw with the pen or eraser, choose from seven ink colors and three pen sizes, and clear, undo, or redo gestures. The saved response contains the Excalidraw scene (`elements`, `appState`, and `files`). Returning to a task with **Previous** restores its current drawing; a new trial starts with the configured initial drawing. ReVISit's replay records the drawing's provenance, including tool and style changes.
