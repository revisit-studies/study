---
name: specify-github-issues
description: Structured workflow for turning a specific underspecified GitHub issue into a detailed, reviewed specification. Use only when the user provides one or more explicit issue numbers or URLs and asks to specify, clarify, or prepare those issues; draft clarifying questions with recommended defaults, incorporate user edits, update issue bodies while preserving original intent, and apply the `specified` label.
---

# Specify GitHub Issues

## Overview

Use this skill to run a two-phase issue-specification workflow for explicitly named issue numbers: first draft clarifying questions with recommended defaults, then apply the user's reviewed answers back to those issues and label them `specified`.

## Workflow

### 1. Establish Scope

- Determine the repository and issue source from the user request, active workspace, GitHub URL, or available GitHub tools.
- If the repository cannot be determined safely, ask for it before querying issues.
- Require the user to provide at least one issue number or issue URL. If none is provided, ask for the issue number and stop.
- Do not scan or process every open issue. If the user asks for all open issues, explain that this skill requires specific issue numbers and ask them to choose the first issue or a small explicit list.
- Respect higher-priority repo or user instructions about GitHub access. If direct GitHub writes are prohibited, draft the updates instead of mutating issues.
- Treat `specified` as the default label name unless the user names a different label.

### 2. Fetch The Named Issues

- Fetch only the issue numbers or issue URLs explicitly provided by the user.
- Confirm each item is an open issue, not a pull request.
- If an issue already has the `specified` label, tell the user and ask whether to revise the existing specification or skip it.
- Capture each issue's number, title, URL, labels, author-provided body, comments if relevant, and any linked project context available without excessive digging.
- If the user provides many issue numbers, process them in clear batches and preserve the per-issue mapping throughout.

### 3. Analyze What Is Underspecified

For each issue, separate:

- Confirmed intent from the existing issue.
- Missing decisions needed before implementation.
- Assumptions implied by the codebase, product conventions, labels, or related issues.
- Risks if the issue is implemented as written.
- Possible acceptance criteria and test expectations.

Look for gaps in scope, users/personas, UX, data model, API contracts, validation, error states, permissions, migration/backfill, analytics, performance, accessibility, compatibility, rollout, dependencies, non-goals, edge cases, and tests.

### 4. Ask Clarifying Questions With Defaults

Produce a review packet, not issue mutations. Ask a thorough but useful set of questions for each issue. Every question must include a recommended default.

Use defaults that are conservative, testable, aligned with existing project behavior, and likely to preserve the issue's original intent. Mark defaults clearly as recommendations, not accepted decisions.

Recommended format:

```markdown
## #123 Issue title

Current intent:
...

Needs specification:
- ...

Clarifying questions and recommended defaults:
1. Question: ...
   Recommended default: ...
   Why this default: ...

Proposed acceptance criteria:
- ...

Suggested non-goals:
- ...
```

After presenting the review packet, stop and wait for the user's edited answers or approval before updating issues.

### 5. Apply Reviewed Specifications

When the user returns edited answers:

- Map answers back to issue numbers. If a mapping is ambiguous, ask before writing.
- Preserve the original issue body and intent. Prefer appending a structured `Specification` section unless the issue already has a clear specification section that should be updated in place.
- Do not close issues, change priority, assign owners, edit milestones, or remove existing content unless explicitly requested.
- Add the `specified` label only after the issue body update succeeds.
- If the label does not exist and the available tool cannot create it, report that clearly and provide the exact next action needed.

Suggested issue-body structure:

```markdown
<existing issue body>

---

## Specification

_Added after specification review._

### Summary
...

### Decisions
- ...

### Acceptance Criteria
- [ ] ...

### Out of Scope
- ...

### Implementation Notes
- ...

### Testing Notes
- ...

### Open Questions
- ...
```

Omit empty sections. Keep wording faithful to the user's reviewed answers. If there are unresolved questions, include them under `Open Questions` and do not apply the `specified` label unless the user explicitly says the issue is sufficiently specified despite them.

### 6. Verify And Report

After each update:

- Verify the issue body contains the new specification.
- Verify the `specified` label is present.
- Report the issue number, title, URL, whether the body update succeeded, and whether labeling succeeded.
- Call out any issues skipped because they still need decisions.
