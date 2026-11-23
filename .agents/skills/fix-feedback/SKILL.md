---
name: fix-feedback
description: Implement new review or user feedback while preserving earlier fixes and avoiding regressions. Use when the user invokes $fix-feedback with feedback to apply; do not perform an independent adversarial review.
---

# Fix Feedback

Implement the supplied feedback with the smallest change that satisfies it, while preserving previously implemented feedback and the behavior those fixes protect. The usual prompt is: `$fix-feedback Here is new feedback: <feedback>`.

## Before changing code

- Read the applicable repository instructions and inspect the current worktree and relevant code/tests. Follow repository rules for version-control commands and protected files.
- Build a short preservation checklist from prior feedback in the conversation, explicit user notes, existing changes, relevant tests, and nearby code. Treat the user's stated earlier fixes as acceptance criteria. Do not overwrite, undo, or duplicate a fix that is already present and correct.
- Trace the new feedback through its actual code path. Verify whether it is actionable, already fixed, stale, or unsupported. If it is already fixed, validate the existing behavior and make no code change for that item.
- Before implementation, identify the expected behavior, the earlier invariants that must remain true, and plausible ways the fix could regress them. Prefer a focused regression test that fails on the reported defect and also asserts the important preserved behavior. Add or adapt tests before the implementation when practical; do not add redundant coverage when a suitable test already exists.

## Implement and validate

- Follow the `implement` skill's principles: correctness, YAGNI, KISS, DRY, ownership of state and behavior, concise changes, focused tests, and a complete local self-review. Use the repository's existing conventions and dependencies.
- Keep the change within the feedback's scope. Do not perform an independent adversarial review or expand the task into unrelated cleanup.
- For UI changes, include accessibility in the acceptance criteria. Prefer native semantic elements: actions must be buttons, navigation must be links, and form controls must have programmatic labels. A button's accessible name should match its visible button text; do not add a conflicting or redundant `aria-label`. For custom widgets, use the appropriate ARIA role, state, relationships, and keyboard behavior. Preserve focus behavior and check that status/errors are exposed accessibly when relevant. Use existing accessibility tests or add focused assertions where the changed interaction warrants them.
- Run the smallest relevant validation available and any additional checks required by repository instructions. Do not claim validation that was not run. Review the final changes against both the new feedback and the preservation checklist; remove speculative changes and leave already-fixed behavior intact.

## Handoff

Summarize the feedback applied or confirmed already fixed, the earlier behavior preserved, files changed, and validation results. Call out any feedback that could not be verified or any environment limitation. Do not claim an independent review occurred.
