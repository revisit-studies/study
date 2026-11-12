# Gamepad Input with Provenance

This demo drives a reVISit stimulus with a game controller instead of a mouse or
keyboard, and captures the result through both of reVISit's data channels at once.

## What you need

A game controller plugged in or paired with your computer — an Xbox controller over
USB works well. **Browsers hide gamepads from a page until that page receives gamepad
input**, as an anti-fingerprinting measure, so each trial begins by asking you to
press any button. Nothing is recorded before that press.

This study also asks permission to record your screen, so that the replay in the
analysis view shows the reticle actually moving rather than just the moments you
pressed a button.

## The task

A colored target appears with a letter on it. Move the crosshair onto the target with
the left stick (the d-pad also works), then press the matching face button:

- **A** — green
- **B** — red
- **X** — blue
- **Y** — amber

Pressing the wrong button, or the right button while off target, counts as a miss.
You can move to the next page at any time, whether or not you finish every target.

## What gets recorded

Two different layers, answering different questions:

- **`windowEvents`** gets the raw controller telemetry — every button down and up, and
  a throttled stream of stick positions — alongside the mouse and keyboard events
  reVISit already captures.
- **Trrack provenance** gets the semantic events: a target spawning, and each button
  press with whether it hit. In the analysis view these nodes are drawn in the color
  of the button that produced them, so a trial reads as a colored sequence of presses.

Per-frame stick motion is deliberately kept out of the provenance graph — it would
bloat the graph without adding meaning. The screen recording covers that instead.

## A caveat worth knowing

The Gamepad API has no input events. Button state has to be polled and compared
against the previous read, which reVISit does once per animation frame. Timestamps
therefore mark when the poll *noticed* a press, up to one frame (roughly 8–16 ms)
after the button physically closed. That is fine for target selection, but it is a
real limit for precision reaction-time work.
