# Drawing library

The drawing library provides a reusable Excalidraw canvas with study controls and managed Trrack provenance. It uses the host's `useTrrack` stimulus parameter so drawing updates, settings, clear, undo, and redo are captured automatically. Replay applies `provenanceState` without recording new events or allowing edits.

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
  "sequence": { "order": "fixed", "components": ["sketch"] }
}
```

Alternatively, use `$drawing.sequences.drawing` to include the default canvas.

The parameters are optional. The borderless canvas fills the available study width and remaining height by default, leaving room for study controls and navigation. Set `height` to a number of pixels for a fixed-height canvas. `responseId` defaults to `drawing`; `initialColor` defaults to `red`; `initialPenSize` defaults to `m`; and `requireDrawing` defaults to `false`. Supported ink colors are red, green, blue, orange, grey, black, and violet. Supported pen sizes are `m`, `l`, and `xl`. `initialDrawing` can seed a canvas with an Excalidraw scene. There is no participant-specific localStorage dependency: trials begin with the configured initial drawing.

The final response is an object with `format: "excalidraw"`, `elements`, `appState` (camera and background), and `files`. Deleted elements are retained to support state restoration. `requireDrawing` is satisfied only by visible, nondeleted elements. If you customize `responseId`, update the hidden reactive response's `id` as well.

Undo and redo operate on complete gestures, while provenance records intermediate drawing samples at most once every 100 ms and a final state at pointer-up. Clear, undo, and redo also appear as explicit events. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z use the study controls, and P/D and E select the pen and eraser. Excalidraw's native toolbars and menus are hidden. Native editing shortcuts, clipboard paste/cut, and drag-and-drop imports are blocked so edits stay within the study's gesture history; Escape does not switch tools.

## Replay

`provenanceState` contains `{ state, tool, color, penSize }`, where `state` is an Excalidraw scene or `null`. Replay restores scenes and settings without allowing edits or recording new events. Empty states clear the display.

See `public/library-drawing/` for a complete runnable example. The implementation is in `src/public/libraries/drawing/assets/` and its unit tests are in the sibling `tests/` folder.
