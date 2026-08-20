---
name: specify-github-issues
description: Turn explicitly named GitHub issues into implementation-ready specifications through evidence gathering, targeted clarification, and an adversarial YAGNI review. Use when the user asks to specify, clarify, or prepare one or more issue numbers or URLs; do not use for an unspecified backlog or for silently mutating issues before review.
---

# Specify GitHub Issues

Create a specification that another engineer can implement without rediscovering the product intent, affected surface, edge cases, or acceptance criteria. Treat the issue and the user's proposed solution as inputs to investigate, not as proof that the proposed scope or design is correct.

Use a staged workflow. Do not draft a final specification, update an issue, or apply the `specified` label until material unknowns have been resolved or the user explicitly accepts documented assumptions.

## 1. Establish the exact scope

- Require at least one explicit issue number or issue URL. Do not scan or process an entire backlog.
- Determine the canonical repository and confirm that each item is an open issue, not a pull request.
- Fetch the issue title, body, labels, relevant comments, linked issues, and available project context.
- Inspect the relevant code, configuration, current UI, routes, API/storage contracts, and tests before deciding what is underspecified. If the repository or required evidence is unavailable, say so and ask for it.
- Separate the confirmed problem from the user's suggested implementation. Do not treat a requested component, endpoint, database field, or refactor as necessary until its purpose is established.

Build an initial scope map for each issue:

- Who is affected and what user or system action starts the behavior?
- What exact URL, route, page, entry point, API endpoint, deep link, or external resource is affected?
- Which exact UI elements, controls, content regions, states, and responsive layouts are affected?
- Which files, components, data sources, providers, storage records, or external systems are involved?
- What is the current behavior, what is wrong, and what should remain unchanged?
- What are the reproduction steps, expected result, and observable failure or success signal?

If any of these are unknown, they belong in the clarification round rather than in a guessed specification.

## 2. Ask a first clarification round

Produce a review packet, not issue mutations. Ask only questions that resolve a material implementation decision, but ask enough that the final spec cannot be mistaken for a different feature.

Every question must include:

- The decision being requested
- A recommended default grounded in the issue, current code, or existing product behavior
- Why the default is the smallest safe and maintainable choice
- What would change if the user selects another option

Cover the applicable dimensions below. Explicitly ask about URLs/routes and UI elements whenever the issue has a user-facing surface.

- **Problem and users:** affected persona, trigger, current behavior, desired outcome, reproduction, frequency, severity, and non-affected users
- **Surface:** exact URL(s), route(s), entry point(s), screen/page, component(s), API endpoint(s), storage record(s), and external integration(s)
- **UI behavior:** exact elements and copy, placement, visibility, enabled/disabled rules, loading/empty/error/success states, navigation, focus, keyboard behavior, responsiveness, and accessibility
- **Data and contracts:** inputs, outputs, persistence, validation, defaults, serialization, backward compatibility, permissions, privacy, and failure handling
- **Boundaries:** supported and unsupported cases, non-goals, compatibility constraints, rollout or migration needs, and what must not change
- **Verification:** observable acceptance criteria, regression cases, unit/integration/E2E coverage, and how a reviewer can reproduce the result

Use a format like:

```markdown
## #123 Issue title

### Evidence and confirmed intent
- ...

### Unknowns that block a reliable specification
- ...

### Clarifying questions and recommended defaults
1. **Affected URL and entry point:** Which exact URL or route should change?
   **Recommended default:** `/the-existing-route`, because the current code and issue reproduction point there.
   **Why:** This keeps the fix within the reported surface and avoids expanding navigation.
   **If different:** The acceptance criteria, affected files, and E2E coverage must change.

2. **UI surface:** Which controls or content regions should be changed, and what should happen in loading, empty, error, and disabled states?
   **Recommended default:** ...
   **Why:** ...
   **If different:** ...

### Proposed non-goals
- ...
```

After presenting the packet, stop and wait for the user's answers or approval. Do not append a specification or label the issue yet.

## 3. Re-check and challenge the proposed scope

After the user answers, map every answer to the issue and re-inspect the affected code and contracts. Ask focused follow-up questions for any remaining material ambiguity; multiple clarification rounds are expected when the issue spans UI, persistence, or integrations.

Before drafting the specification, conduct an explicit adversarial scope review:

- Is this solving the confirmed problem, or only implementing the user's preferred mechanism?
- Is the requested behavior already available through a smaller change, existing component, route, configuration option, or shared utility?
- Does each new abstraction, dependency, state field, endpoint, migration, compatibility path, and UI state have a demonstrated need?
- Can any proposed behavior, option, generalized API, or future-proofing be removed without failing the stated outcome?
- Does the scope introduce duplicated sources of truth, new persistence, migration risk, security/privacy exposure, accessibility regressions, or unnecessary operational burden?
- Are the acceptance criteria precise enough to distinguish the fix from a plausible but incorrect implementation?

Push back clearly but respectfully when the evidence does not support the requested scope. Offer the smallest sufficient alternative and ask the user to confirm whether the broader request is still intentional. Do not reject complexity required for correctness, security, compatibility, accessibility, or an explicitly accepted requirement.

If the user does not resolve a material challenge, leave it as an open decision and do not claim the issue is fully specified.

## 4. Draft the implementation-ready specification

Draft only after the affected surface, behavior, boundaries, and verification approach are sufficiently determined. The specification should let another engineer implement the work without another product-discovery round.

Prefer appending this structure to the existing issue body:

```markdown
---

## Specification

_Added after clarification and scope review._

### Summary
One concise statement of the confirmed problem and smallest sufficient outcome.

### Users and affected surface
- Users/personas:
- Trigger/reproduction:
- Exact URL(s), route(s), entry point(s), or API endpoint(s):
- Affected UI elements and states:
- Relevant code, data, storage, or external contracts:

### Required behavior
Describe the behavior as observable cases, including success, loading, empty, error, disabled, navigation, and accessibility behavior where applicable.

### Data and contract changes
Describe inputs, outputs, persistence, validation, defaults, compatibility, permissions, privacy, and migration/backfill requirements. State explicitly when no data or contract change is required.

### Acceptance criteria
- [ ] ...

### Tests and verification
- Unit/integration coverage:
- E2E or manual reproduction:
- Regression and edge cases:

### Non-goals and rejected scope
- ...

### Implementation notes
Only include constraints supported by the codebase or confirmed decisions. Do not prescribe an implementation when multiple simple implementations satisfy the contract.

### Open questions and assumptions
Include only unresolved items that the user explicitly accepted as assumptions. Otherwise, stop clarification before labeling.
```

Acceptance criteria must be testable and specific about the affected surface. Include negative cases and preservation requirements, not only the happy path. Keep the specification concise: remove background, options, and implementation detail that do not affect implementation or verification.

## 5. Apply only an approved, complete specification

When the user approves the specification or returns final answers:

- Map each decision to the correct issue number. If mapping is ambiguous, ask before writing.
- Preserve the original issue body and intent. Append or update a structured `Specification` section rather than replacing useful author context.
- Do not close issues, change priority, assign owners, edit milestones, or remove existing content unless explicitly requested.
- Do not apply `specified` while material questions, unsupported assumptions, or unresolved scope challenges remain.
- Add the `specified` label only after the issue body update succeeds. Use `specified` unless the user names another label.
- If the label does not exist or the available GitHub capability cannot create it, report that clearly and provide the exact next action.

## 6. Verify and report

After each update:

- Re-fetch the issue and verify the specification is present and readable.
- Verify the expected label is present.
- Report the issue number, title, URL, body-update result, label result, and any remaining assumptions.
- Distinguish confirmed facts, user-approved decisions, agent recommendations, and unresolved risks.

If the issue is not ready, report the blocking questions and the smallest next decision needed instead of presenting an implementation-ready conclusion.
