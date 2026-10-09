# Stroop Test with Factors


## Overview of the implementation

This study shows how factors generate within- and between-subjects experiments without listing every trial separately in JSON using the example of the Stroop test. In a Stroop test, a word for a color (e.g., blue, red etc.) is shown to a participant using a font color which may or may not be the same as the word (e.g., the word red displayed in blue font). In a study testing the Stroop effect, different color words are displayed using either neutral or incongruent font color (the font color is congruent if it matches the word being displayed i.e., the word red displayed in red font). Thus, color here is a factor, which varies across stimuli in a within-subjects design. For this example, we vary font size as a between-subjects factor, purely for demonstrative purposes.

`color` is a within-subjects factor with five levels ("RED", "YELLOW", "GREEN", "BLUE", "BLACK"), and `fontSize` is a between-subjects factor with two levels ("14px" and "42px"). The sequence uses the `cross` action to create a tuple for every possible pair of value in `color` (e.g., ("RED", "RED"), ("RED", "YELLOW"), ("RED", "GREEN"), ...) where the first value in the tuple specifies the word that will be displayed and the second value in the tuple specifies font color. Referencing `color` twice in `cross` thus creates all 25 ordered pairs, while `as` exposes their generated parameters as `word` and `inkColor`.


## Instructions to participants

In this experiment, you will be shown a a word for a color (e.g., blue, red etc.) using a font color which may or may not be the same as the word (e.g., the word red displayed in blue font). On every trial, report the **ink color** of the displayed word while ignoring what the word says. Respond with the on-screen buttons or their corresponding number keys.

Try to respond as quickly and accurately as possible.
