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
        "height": 600,
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

The parameters are optional. `responseId` defaults to `drawing`; `height` defaults to 600 pixels; `initialColor` defaults to `red`; `initialPenSize` defaults to `m`; and `requireDrawing` defaults to `false`. Supported ink colors are red, green, blue, orange, grey, black, and violet. Supported pen sizes are `m`, `l`, and `xl`. `initialDrawing` can seed a canvas with an Excalidraw scene or an archived freehand tldraw snapshot. There is no participant-specific localStorage dependency: trials begin with the configured initial drawing.

The final response is an object with `format: "excalidraw"`, `elements`, `appState` (camera and background), and `files`. Deleted elements are retained to support state restoration. `requireDrawing` is satisfied only by visible, nondeleted elements. If you customize `responseId`, update the hidden reactive response's `id` as well.

Undo and redo operate on complete gestures, while provenance records intermediate drawing samples at most once every 100 ms and a final state at pointer-up. Clear, undo, and redo also appear as explicit events. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z use the study controls, and P/D and E select the pen and eraser. Excalidraw's top bar and main menu are hidden.

## Archived drawings

`provenanceState` accepts the completed study's `{ state, tool, color, penSize }` format. When `state` is a legacy `{ document, session }` snapshot, freehand strokes are translated at display time. Both point arrays and delta-encoded paths are supported. IDs, stacking order, coordinates, scale, rotation, pressure, opacity, palette, and camera are preserved. Widths compensate for Excalidraw's freehand size multiplier. Empty states clear the display. Original provenance graphs do not need migration.

The adapter supports freehand shapes on the recorded current page. Other tldraw shape types are rejected explicitly. Smoothing and pressure rendering differ between engines, so this is not pixel-identical archival rendering. No tldraw runtime or copied Trrack implementation is included.

See `public/library-drawing/` for a complete runnable example. The implementation is in `src/public/libraries/drawing/assets/` and its unit tests are in the sibling `tests/` folder.
