---
name: adversarial-review
description: Launch an independent adversarial review subagent on gpt-5.6-sol with high reasoning effort to challenge work for correctness, regressions, edge cases, test adequacy, and YAGNI minimality. Use when the user invokes $adversarial-review or asks to launch, spawn, or run an adversarial reviewer or review subagent to check correctness, conciseness, simplicity, speculative complexity, unnecessary churn, or overlooked issues.
---

# Adversarial Review

Launch exactly one independent, read-only reviewer. Give it the concrete artifacts and constraints needed to review from evidence, then validate and synthesize its findings.

## Prepare the handoff

Identify the review target from the request and current task. Gather enough concrete state to make the handoff self-contained:

- Objective and acceptance criteria
- Repository and relevant paths, or artifact locations
- Exact comparison scope such as base, head, merge base, diff, plan, or document
- Important constraints and domain invariants
- Validation already performed and any known failures
- Questions the reviewer must answer

Do not include the parent's conclusions as facts. Ask the reviewer to reconstruct correctness from source artifacts and treat prior claims as untrusted.

Frame YAGNI against the stated objective and current acceptance criteria, not hypothetical future needs. Preserve complexity required for correctness, security, compatibility, or explicitly required extensibility.

## Launch the reviewer

Call `collaboration.spawn_agent` directly with:

- `task_name`: `adversarial_review`, adding a short numeric suffix only if that name is already in use
- `model`: `gpt-5.6-sol`
- `reasoning_effort`: `high`
- `fork_turns`: `none`
- `message`: the self-contained handoff plus the review contract below

Use this review contract:

> Act as an independent adversarial reviewer. Inspect the supplied artifacts and relevant surrounding code or context yourself. Challenge correctness first, then apply YAGNI: every abstraction, dependency, configuration surface, compatibility path, test, and documentation change must serve the stated objective or current acceptance criteria. Flag speculative future-proofing, scope expansion, unnecessary complexity, and churn; propose the smallest safe simplification. Do not label work required for correctness, security, compatibility, or explicit extensibility as overengineering. Also look for behavioral regressions, broken contracts or invariants, edge cases, unsafe assumptions, and missing or misleading tests. Verify suspected issues before reporting them. Do not edit files, push changes, post comments, or mutate external state. Return only evidence-backed findings ordered by severity, with precise file and line references when available and a suggested resolution for each. If there are no findings, say so and identify residual risks or verification gaps.

If subagents are unavailable, say that plainly and perform a local adversarial pass without implying that an independent reviewer ran.

## Integrate the result

Continue useful local work while the reviewer runs when the tasks do not conflict. Wait for the reviewer before presenting a final correctness judgment.

Independently confirm each reported issue against the current artifacts. Reject false positives and stale-scope findings. Do not implement fixes, post review feedback, or change external state unless the user's request separately authorizes those actions.

Report:

- Confirmed findings, ordered by severity, with suggested resolutions
- Any reviewer claims rejected after local verification
- Whether the work is correct and the smallest sufficient solution within the reviewed scope
- Residual risks and checks not performed
