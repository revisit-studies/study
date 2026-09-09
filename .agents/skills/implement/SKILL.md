---
name: implement
description: Implement requested features, bug fixes, and scoped refactors with code-grounded decisions, minimal changes, and meaningful tests. Use when the user invokes $implement or asks to implement a feature, apply fixes, or simplify existing code. Do not use for read-only reviews or specification-only requests.
---

# Implement

Deliver the smallest clear, correct solution that fully meets the current request. Carry authorized implementation through validation and handoff. Scale the process to the change; a small fix does not need a design document or ceremony.

## Ground the work

- Read applicable repository instructions and inspect the working tree before editing. Preserve unrelated changes; isolate work when the current checkout would create conflicts or mix scopes.
- Establish the intended behavior, acceptance criteria, and constraints from the request and code. Preserve the user's explicit choices and implementation order. Resolve routine details from established patterns; ask only when missing information materially changes the intended behavior or safe scope, and continue independent work while waiting.
- Trace the actual path through relevant callers, state, storage, and consumers. Inspect existing helpers and tests before designing replacements. For bugs, reproduce the failure when practical and identify its cause before patching symptoms.
- Treat issue descriptions, review comments, and prior conclusions as leads. Verify them against current code. For PR fixes, confirm the live base and head and distinguish actionable defects from fixed, stale, duplicate, or unsupported feedback. If the requested behavior is already correct, verify it and avoid manufacturing a change.

## Design and implement

Apply these principles together, with correctness and required contracts taking precedence over brevity:

- **Correctness:** Preserve domain invariants and required security, compatibility, and operational behavior. Fix the cause at the appropriate ownership boundary and update affected consumers. Consider relevant failure paths and state transitions, not just the happy path.
- **YAGNI — You Aren't Gonna Need It:** Judge every abstraction, dependency, configuration option, compatibility path, test, and documentation change against the current objective. Add only what serves it. Preserve complexity required for correctness, security, compatibility, or explicitly requested extensibility.
- **KISS — Keep It Simple:** Prefer direct control flow, existing conventions, and the fewest concepts needed to explain the behavior. Avoid speculative frameworks, layers, indirection, and fallback chains. Choose the easiest correct implementation to understand and maintain.
- **DRY — Don't Repeat Yourself:** Reuse the canonical implementation of a business rule or invariant. Extract shared logic when it represents the same responsibility and reduces real duplication. Similar-looking code alone is not a reason to couple unrelated behavior or introduce a general abstraction.
- **TDA — Tell, Don't Ask:** Keep behavior with the component or module that owns the relevant state and invariants. Prefer an operation expressing intent over callers reading internal state, making a decision, and writing it back. Keep legitimate queries and pure transformations; do not force an object-oriented redesign or hide useful data merely to follow the acronym.
- **Conciseness:** Minimize changed files and lines while retaining clear names, readable expressions, and explicit contracts. Prefer removing unnecessary code to adding machinery. Avoid clever compression, unrelated formatting, renaming, and cleanup. Use comments to explain non-obvious reasons or constraints.

Make cohesive changes within the requested scope. Update types, callers, tests, and documentation when the changed contract requires it. Remove code made obsolete by this implementation when it is safe and in scope. Do not silently swallow errors or add defensive branches for impossible states; handle real boundary failures explicitly using the repository's conventions.

## Test what matters

- Choose coverage from acceptance criteria and plausible regressions. Cover changed observable behavior and meaningful invariants at the lowest test level that exercises them faithfully; use integration or browser tests when the risk crosses those boundaries.
- For a bug fix, add or adapt a focused regression test when it provides lasting value. Demonstrate that it fails for the original defect and passes with the fix when practical. For features, cover the core behavior plus relevant negative and boundary cases.
- Extend existing tests and fixtures before creating new infrastructure. Keep tests deterministic and assert outcomes or required side effects. Mock external boundaries when needed without mocking away the behavior under test.
- Apply YAGNI to tests: avoid assertions tied to incidental implementation details, redundant coverage, exhaustive combinations without distinct risk, broad snapshots, and tests of framework behavior. Do not chase a coverage percentage or build a harness for a trivial change. A reversible, low-impact edit may need only an existing check or direct verification.
- Run focused checks first, then required repository checks and additional checks justified by the affected surface. Fix failures caused by the change; distinguish pre-existing failures and environment limitations with evidence. Never weaken a valid assertion to make a failure disappear. After checks pass, repeat or broaden them only for new changes or unresolved concerns.

## Challenge the result

Review the complete final diff and relevant consumers against the acceptance criteria. Challenge correctness first, then simplicity. Check applicable risks such as boundary values, error handling, authorization, concurrency, persistence, resource cleanup, compatibility, and documentation contracts; do not turn every small fix into an unrelated audit.

Take a fresh pass after fixes and simplifications until a complete follow-up pass finds no new evidence-backed, in-scope issue. Confirm suspected defects before changing code. Remove speculative machinery and unnecessary churn without discarding necessary safeguards. Re-run checks affected by subsequent edits.

This is a local self-review. If the user also requests an independent adversarial review, use the available adversarial-review skill, wait for its result, and independently verify its findings before applying in-scope fixes. Do not imply an independent reviewer ran when one did not.

## Finish and report

Complete the authorized delivery steps. Use git for version control and gh for GitHub issues and PRs; stop GitHub operations on authentication issues. Stage only intended files. Respect existing authorization without asking again; this skill itself does not grant permission to push, post feedback, approve, merge, or deploy. Merge only with explicit approval, using a merge commit.

Report concisely:

- What changed and the resulting behavior, including any important tradeoff.
- What validation passed and any remaining failures, unverified behavior, or blockers. Keep local checks and remote CI distinct, and tie remote results to the current head.
- Delivery state, including whether local changes remain uncommitted or unpushed. For unresolved issues, give a suggested resolution grounded in the code.
