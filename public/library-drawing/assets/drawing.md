# Drawing: Provenance-Tracked Sketching

This is a demo of the library `drawing`.

A borderless freehand drawing canvas that fills the available study area, with pen, eraser, seven ink colors, three pen sizes, clear, undo, and redo. Uses Excalidraw with reVISit's managed Trrack provenance capture for participant replay. The final scene is saved as the drawing response. Parameters: responseId (default drawing), height (optional fixed height in pixels; otherwise fills available space), initialColor (default red), initialPenSize (m, l, or xl; default m), initialDrawing (optional scene), and requireDrawing (default false). The component also renders archived pen-only tldraw snapshots passed through provenanceState; rendering is approximate because the freehand engines differ.

## Reference

Link: [https://docs.excalidraw.com/](https://docs.excalidraw.com/)

## Available Components

- canvas

## Available Sequences

- drawing
