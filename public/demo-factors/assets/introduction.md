# Factors Demo

This study shows how factors generate within- and between-subjects experiments without listing every trial separately in JSON. The displayed parameters on each trial reveal the values assigned to that trial.

For the within-subjects examples, `data` (`d1`–`d3`), `visType` (`v1`–`v3`), and `task` (`t1`–`t3`) supply reusable values. The sequence uses `cross` to make every data/visualization pairing, `zip` to pair values by position, `concat` to place sets of values one after another, `repeat` to reuse tasks, and `sample` to choose from the `topics` factor. Some blocks also combine these operations or vary trial order with random or Latin-square scheduling.

For the between-subjects example, `ageGroup` is assigned as either `young` or `old` for each participant. That value selects the corresponding tutorial Markdown file later in the sequence. Together, these examples show how a short set of factor definitions can produce many trial combinations and participant assignments.
