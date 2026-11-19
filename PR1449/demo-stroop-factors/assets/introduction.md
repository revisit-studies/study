# Stroop Test with Factors

This example uses reVISit's factors syntax to generate a complete incongruent Stroop design from one ten-level `color` factor. Referencing `color` twice in `cross` creates all 100 ordered pairs, while `as` exposes their generated parameters as `word` and `inkColor`. A `subtract` expression then removes the ten congruent pairs produced by `zip`, leaving 90 trials that are shown in a random order.

On every trial, report the **ink color** of the displayed word while ignoring what the word says. Respond with the on-screen buttons or their corresponding number keys.

Try to respond as quickly and accurately as possible.
