---
name: specify-github-issues
description: Turn explicitly named GitHub issues into concise, implementation-ready specifications through evidence gathering, targeted clarification, and an adversarial YAGNI review. Use when the user asks to specify, clarify, or prepare issue numbers or URLs; do not process an unspecified backlog or mutate issues before review.
---

# Specify GitHub Issues

Produce a specification another engineer can implement without rediscovering the problem, affected surface, edge cases, or acceptance criteria. Treat the issue and any proposed solution as inputs to investigate, not as proof that the requested scope or mechanism is correct.

## 1. Establish scope from evidence

- Require at least one explicit issue number or URL. Do not scan a backlog.
- Resolve the canonical repository and confirm each item is an open issue, not a pull request.
- Fetch the issue body, labels, relevant comments, and linked context.
- Inspect the relevant code, routes, UI, data/storage/API contracts, and tests before deciding what is underspecified. If required evidence is unavailable, ask for it.
- If the issue already has a `Specification` section or `specified` label, show it and ask whether to revise or skip it.

For each issue, record the evidence and identify unknowns across this single checklist:

- affected users, trigger, current behavior, desired outcome, and reproduction;
- exact URL, route, page, entry point, API endpoint, or external resource;
- exact UI elements and relevant loading, empty, error, disabled, navigation, responsive, and accessibility states;
- involved files/components, data sources, persistence, permissions, and external contracts;
- what must remain unchanged, non-goals, edge cases, and how success will be verified.

Ask the user only about decisions the evidence cannot settle. Never fill a material gap with an unmarked assumption.

## 2. Clarify before drafting

Create a review packet; do not mutate GitHub. Ask a targeted question for each material decision. Every question gets a recommended default and a brief rationale grounded in the issue, codebase, or existing product behavior. Mention alternatives only when they materially change scope or risk.

Cover only the applicable parts of the checklist above, especially the exact URL/route and UI surface for user-facing work. Include data/permission behavior, boundaries, non-goals, and tests when they affect implementation. Keep the packet concise and distinguish confirmed facts, user decisions, recommendations, and unresolved risks.

After the packet, stop and wait for answers. If a material ambiguity remains, ask a focused follow-up rather than drafting around it. If the evidence already resolves the scope, present a draft for review instead of inventing questions.

## 3. Challenge the scope, then draft

After answers arrive, re-check the affected code and contracts and challenge the request:

- Does it solve the confirmed problem, or only implement the user's preferred mechanism?
- Can an existing component, route, configuration option, or utility solve it with less code and state?
- Is every new abstraction, dependency, state field, endpoint, migration, compatibility path, and UI state necessary for the stated outcome?
- Does the proposal create duplicated sources of truth, unnecessary persistence, security/privacy risk, accessibility regressions, or operational burden?

Push back respectfully when the evidence does not support the requested scope. Offer the smallest sufficient alternative. Preserve complexity required for correctness, security, compatibility, accessibility, or an explicitly accepted requirement. Do not proceed while a material scope challenge is unresolved.

Present the exact draft Markdown and stop. Do not update GitHub until the user explicitly approves that draft and authorizes the write.

Use this structure, omitting sections that do not apply:

```markdown
## Specification

### Summary
The confirmed problem and smallest sufficient outcome.

### Affected surface
- Users and trigger/reproduction:
- Exact URL(s), route(s), entry point(s), or endpoint(s):
- UI elements and states:
- Relevant code, data, storage, or external contracts:

### Required behavior
Observable success, failure, empty/loading/disabled, navigation, and accessibility behavior where applicable.

### Acceptance criteria
- [ ] Testable behavior, including negative cases and preservation requirements.

### Tests and verification
- Unit/integration/E2E or manual reproduction:

### Non-goals and assumptions
- Only confirmed boundaries and explicitly accepted assumptions.
```

Keep the specification concise. Do not prescribe an implementation when multiple simple implementations satisfy the contract.

## 4. Apply and verify an approved specification

After explicit approval of the exact draft and authorization to write:

- Re-fetch the issue body, labels, and relevant comments immediately before writing. If they changed materially, reconcile and obtain renewed approval.
- Preserve the original body and intent; append or update only the structured `Specification` section.
- Do not close issues, change priority, assign owners, edit milestones, or remove existing content unless explicitly requested.
- Update the body first, then add the `specified` label (or the user-named label). If the label cannot be created, report that clearly.
- Re-fetch after the update and verify the specification and label.

Report the issue number, title, URL, body-update result, label result, confirmed decisions, assumptions, and any remaining risks. If the issue is not ready, report the blocking question instead of claiming it is specified.
