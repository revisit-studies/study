---
name: review-loop
description: Repeatedly review and fix local work on a pull request branch with independent adversarial reviewers, stopping when the change is correct and minimal or a bounded review limit requires human judgment. Use when the user asks for a review loop or iterative adversarial review and implementation.
---

# Review Loop

Improve an authorized change's correctness while keeping its scope and implementation minimal. Use `$adversarial-review` for independent, read-only reviews and `$implement` for confirmed fixes. This skill authorizes neither pushing nor merging.

## Establish the review state

Read repository instructions and identify the objective, acceptance criteria, PR base and remote head, local branch and commits, and in-scope staged, unstaged, and untracked changes. Review the complete local result stacked on the PR branch, including fixes not yet pushed. Preserve unrelated work. Record the local state before each reviewer handoff so findings can be tied to the version reviewed.

## Run the bounded loop

Allow at most **three fresh independent reviewers**, with **up to three fix-and-recheck cycles per reviewer**: at most nine cycles across the run. A fresh reviewer starts a new review round through `$adversarial-review`. Following up with the same reviewer does not start a new round. Unused cycles do not carry into another round. If a reviewer still has a confirmed concern after its third recheck, stop for human review rather than starting another reviewer round.

1. Give the fresh reviewer the current local state and a self-contained handoff. Do not pass prior reviewers' conclusions as facts. Independently verify each finding against the reviewed state. Reject stale, duplicate, unsupported, out-of-scope, or merely stylistic requests that would add churn without improving the current requirements.
2. If no confirmed in-scope issue remains, stop successfully. Otherwise use `$implement` to address the confirmed issues with the smallest clear fix and meaningful validation. Keep changes local while review concerns remain.
3. Follow up with that same reviewer on the new local state, specifically whether its confirmed concerns are resolved correctly and minimally and whether the fixes caused regressions. Independently verify any new claim. If a concern remains and the fix-and-recheck limit allows it, fix and ask the same reviewer again.
4. Once that reviewer has no confirmed concern, start the next fresh round unless three fresh rounds have run. A clean fresh round ends the loop. If the third fresh reviewer finds issues, address them within that reviewer's three-cycle budget and have it recheck; then stop for human review rather than spawning a fourth reviewer.

Do not keep changing code to satisfy unsupported or pedantic preferences. If reviewers disagree about a substantive issue, resolve it from the code and acceptance criteria when possible; otherwise stop and ask for human judgment. Never treat silence, an unavailable reviewer, or an unverified claim as reviewer satisfaction.

## Stop and report

Stop when a fresh reviewer finds no confirmed issue, a reviewer uses its third fix-and-recheck cycle without resolving its concerns, the third review round ends, or a substantive disagreement cannot be resolved. At a limit, report remaining findings by severity, the evidence and suggested code-grounded resolution for each, validation performed, and whether further objections appear to be pedantic churn. Call out any remaining P0 or P1 issue explicitly; do not declare the change ready while one remains.

Keep local checks distinct from remote PR checks. Do not push until a fresh round is clean or the user has reviewed and authorized the result at the limit, even if the last reviewer accepted its fixes. After a successful loop, complete only delivery steps already authorized by the user; never infer permission to approve or merge. Report unpushed local changes clearly.

## Escalate early to a human

The limits are ceilings, not targets. Stop before reaching them when a verified finding shows that the PR's overall approach cannot meet the objective through focused, in-scope fixes; resolving it would require a broad redesign, a changed requirement or contract, or a material expansion of the PR. Also stop when several reasonable fixes have different user-visible or operational tradeoffs that the request does not settle, or when a P0/P1 issue cannot be corrected safely within the authorized scope. Do not spend remaining cycles making local patches around a known architectural problem.

Verify the reviewer's claim against the code before escalating. Explain the root issue, affected behavior, severity, why a focused fix is insufficient, and the smallest viable options with a recommended path. State which local changes and checks are complete and what remains unpushed. Continue routine fixes autonomously when the code and acceptance criteria already determine a safe resolution.
