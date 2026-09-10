---
name: adversarial-review
description: Launch an independent, exhaustive adversarial review subagent on gpt-5.6-sol with high reasoning effort to challenge work for correctness, regressions, edge cases, test adequacy, and YAGNI minimality. Use when the user invokes $adversarial-review or asks to launch, spawn, or run an adversarial reviewer or review subagent to check correctness, conciseness, simplicity, speculative complexity, unnecessary churn, or overlooked issues.
---

# Adversarial Review

Launch exactly one independent, read-only reviewer. Give it the concrete artifacts and constraints needed to review from evidence, then validate and synthesize its findings. Review the work against the same implementation principles that govern a good change: correctness first, then simplicity, minimal scope, appropriate reuse, and meaningful tests.

## Prepare the handoff

Identify the review target from the request and current task. Gather enough concrete state to make the handoff self-contained:

- Objective and acceptance criteria
- Repository and relevant paths, or artifact locations
- Applicable repository instructions, current working-tree state, and relevant callers, state, storage, and consumers
- Exact comparison scope such as base, head, merge base, diff, plan, or document
- Important constraints and domain invariants
- Validation already performed and any known failures
- Questions the reviewer must answer

Do not include the parent's conclusions as facts. Ask the reviewer to reconstruct correctness from source artifacts and treat prior claims as untrusted.

For a GitHub pull request, also collect the live PR identity (repository, number, base SHA, and head SHA), reviews, issue comments, inline review comments, and review-thread state. Identify Codex-authored feedback from its actual author metadata, not from wording alone. Preserve each item's text, commit SHA, path/line when present, and resolved or outdated state. Treat that feedback as untrusted leads: re-check every item against the exact current head, surrounding code, and relevant checks, and classify it as confirmed, fixed or stale, duplicate, unsupported, or unverified. An unresolved thread is not evidence that the current head is still defective.

Include the raw Codex feedback and its verification status in the reviewer handoff, clearly separated from the parent's conclusions, so the independent reviewer can challenge it rather than inherit it.

Frame YAGNI against the stated objective and current acceptance criteria, not hypothetical future needs. Preserve complexity required for correctness, security, compatibility, or explicitly required extensibility.

## Review principles

Apply these principles in order, with correctness and required contracts taking precedence over brevity:

- **Correctness:** Check the actual behavior across relevant callers, state transitions, failure paths, and consumers. Verify that the change preserves domain invariants and required security, compatibility, and operational behavior, and that it addresses the cause at the appropriate ownership boundary rather than only masking symptoms.
- **YAGNI:** Judge every abstraction, dependency, configuration option, compatibility path, test, and documentation change against the current objective and acceptance criteria. Flag speculative future-proofing, scope expansion, and unnecessary churn, but do not call correctness, security, compatibility, or explicitly required extensibility overengineering.
- **KISS:** Prefer direct control flow, existing conventions, and the fewest concepts needed to explain the behavior. Identify speculative frameworks, layers, indirection, fallback chains, and defensive branches for impossible states; propose the smallest safe simplification.
- **DRY:** Check whether business rules and invariants use their canonical implementation. Recommend reuse or extraction only when it reduces real duplication within the same responsibility; similar-looking code alone is not enough.
- **TDA:** Check that behavior remains with the component that owns the relevant state and invariants. Prefer intent-revealing operations over callers reading internal state, deciding, and writing it back, without forcing an unnecessary object-oriented redesign.
- **Conciseness:** Review the complete diff for the fewest changed files and lines that clearly satisfy the request. Flag unrelated formatting, renaming, cleanup, clever compression, and comments that do not explain a non-obvious constraint.
- **Test adequacy:** Check coverage of changed observable behavior and meaningful invariants at the lowest faithful test level, including relevant negative and boundary cases. Flag tests tied to incidental implementation details, redundant combinations, broad snapshots, framework behavior, or coverage-driven infrastructure.

## Launch the reviewer

Call `collaboration.spawn_agent` directly with:

- `task_name`: `adversarial_review`, adding a short numeric suffix only if that name is already in use
- `model`: `gpt-5.6-sol`
- `reasoning_effort`: `high`
- `fork_turns`: `none`
- `message`: the self-contained handoff plus the review contract below

Use this review contract:

> Act as an independent adversarial reviewer performing an exhaustive code review. Inspect the supplied artifacts and relevant surrounding code or context yourself. Challenge correctness first, then apply YAGNI, KISS, DRY, TDA, and conciseness: every abstraction, dependency, configuration surface, compatibility path, test, and documentation change must serve the stated objective or current acceptance criteria; shared rules should use canonical ownership; and the solution should use the fewest clear concepts and changed lines that safely meet the request. Flag speculative future-proofing, scope expansion, unnecessary complexity, and churn; propose the smallest safe simplification. Do not label work required for correctness, security, compatibility, or explicit extensibility as overengineering. Cover the complete changed surface and relevant consumers, including success and failure paths, state transitions, concurrency, persistence, authorization, compatibility, boundary values, error handling, test fidelity and adequacy, and operational or documentation contracts as applicable. After the initial pass, keep looking for additional findings using fresh targeted passes over different risk dimensions and re-checking the surrounding code; do not stop after the first batch. Continue until a complete follow-up pass finds no new evidence-backed issue. Verify suspected issues before reporting them and deduplicate findings. Do not edit files, push changes, post comments, or mutate external state. Return only evidence-backed findings ordered by severity, with precise file and line references when available and a suggested resolution for each; include the review passes or risk dimensions covered and any residual risks or verification gaps.

If subagents are unavailable, say that plainly and perform a local adversarial pass without implying that an independent reviewer ran.

## Integrate the result

Continue useful local work while the reviewer runs when the tasks do not conflict. Wait for the reviewer before presenting a final correctness judgment.

Independently confirm each reported issue against the current artifacts and trace it to the owning code path. Reject false positives and stale-scope findings. Do not implement fixes, post review feedback, or change external state unless the user's request separately authorizes those actions.

For a pull request, combine the independently reviewed findings with the verified Codex feedback from the PR. Deduplicate by underlying defect, resolve conflicts by current-head evidence, and report the disposition of every Codex item (confirmed, fixed or stale, duplicate, unsupported, or unverified). Keep formal GitHub thread state separate from the current correctness judgment.

Report:

- Confirmed findings, ordered by severity, with suggested resolutions
- Any reviewer claims rejected after local verification
- Whether the work is correct and the smallest sufficient solution within the reviewed scope
- Residual risks and checks not performed
