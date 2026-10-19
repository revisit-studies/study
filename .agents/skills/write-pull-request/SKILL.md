---
name: write-pull-request
description: Draft or revise repository-grounded pull request titles and descriptions for senior engineering review, using a fixed architecture-first template and natural human tone. Use when asked to write, create, or update PR copy; do not use for reviewing someone else's code.
---

# Write Pull Request

Write the PR as the engineer responsible for the change. Optimize for a senior reviewer who needs to understand why the change exists, how responsibilities and data or control flow moved, and where the remaining risk is.

## Ground the Draft

Before writing:

- Read the repository instructions and its existing PR conventions.
- Compare the exact head against the intended base. Trace the changed runtime paths, tests, configuration, migrations, and generated artifacts that affect the final behavior.
- For an existing PR, refresh its current head, base, title, body, and check state. Describe the final implementation, not abandoned iterations.
- Separate verified local results, remote checks, pending checks, and work that was not run. Never infer a passing result from the presence of a test or workflow.
- Do not invent motivation, tradeoffs, UI behavior, rollout needs, issue links, or validation. State an unknown plainly when the available evidence cannot resolve it.

Draft locally unless the user has authorized creating or updating the remote PR. When creating a PR, open it as a draft unless the user explicitly asks for it to be ready for review or otherwise non-draft. When publishing is authorized, preserve unrelated PR metadata and read back the resulting title and body.

## Title

Follow an established repository convention when one exists. Otherwise, use a concise imperative title that names the outcome or system boundary, not the implementation chore. Avoid ticket prefixes unless the repository uses them.

## Description Template

Use these headings in this order:

```markdown
## Why

<What problem or constraint prompted the change, why it matters now, and any relevant issue or operational context.>

## Architecture

<Explain the previous path and the new path. Describe ownership, boundaries, data or control flow, important invariants, and the reasoning behind material decisions. Call out compatibility constraints, deliberate non-goals, or meaningful tradeoffs when supported by evidence.>

## User-facing impact

<Briefly describe what a user will notice. Say "No user-facing changes." when accurate. Include screenshots only when they exist and materially help review.>

## Validation

- `<command or check>` — <result>
- <manual or remote check> — <result or current status>

## Risk and rollout

<Identify concrete regression risks and any migration, configuration, deployment, observability, rollback, or sequencing requirements. If no special rollout is needed, say so and briefly explain the remaining risk.>
```

Keep all five sections. Give `Architecture` the most detail when the change is architectural. For a genuinely small or non-architectural change, say that directly instead of inflating it. Keep `User-facing impact` shorter than the architectural explanation unless the PR is primarily a UI change.

## Tone and Style

- Sound like a thoughtful engineer talking to peers: direct, specific, calm, and appropriately candid about uncertainty.
- Prefer active voice, concrete verbs, and short paragraphs. Use bullets only for information that is easier to scan as a list.
- Explain behavior and design decisions rather than narrating files or restating the diff. Mention identifiers and paths only when they help a reviewer follow the architecture.
- Make causal links explicit: what changed, why this layer owns it, and what downstream behavior follows.
- Use `we` only for an actual shared decision. Do not refer to yourself as an assistant or describe the writing process.
- Avoid promotional or synthetic phrasing such as "This PR aims to," "leverages," "seamless," "robust," "comprehensive," "enhances," and "ensures" when a concrete statement would be clearer.
- Avoid canned openings, repetitive sentence shapes, exhaustive file inventories, decorative emoji, and a concluding summary that merely repeats the body.
- Calibrate confidence to the evidence. Prefer "The focused unit suite passed" over "This is fully tested," and identify anything pending or not run.

Use the shortest description that gives a senior reviewer the architectural context, behavioral impact, validation evidence, and operational risk needed to make a decision.
