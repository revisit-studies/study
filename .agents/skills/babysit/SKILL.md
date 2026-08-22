---
name: babysit
description: Continuously shepherd one GitHub pull request to a verified green state by addressing Codex automated review threads, fixing in-scope CI failures, and monitoring the exact current head until the stopping conditions hold. Use when the user says to babysit, shepherd, or keep watching a PR until it is ready; do not use for a one-time status check or to merge a PR.
---

# Babysit a Pull Request

Own the follow-through for one PR. Keep working across review and CI cycles; do not stop merely because a fix was pushed or one snapshot was green.

## Start a Durable Objective

When the user explicitly invokes `$babysit`, says to babysit or keep watching a PR, or otherwise requests persistence until a stated end condition:

1. Resolve the exact repository and PR from the supplied URL or number, or from the current branch.
2. If goal-management tools are available, inspect the current goal. Continue a matching goal, create one when none exists, and do not replace a different active goal without user direction.
3. Set the objective to babysit that exact PR without merging until the current head has no unresolved in-scope Codex review threads, all required and relevant CI is successful, all repairs are pushed, and the final verification is stable. Do not set a token budget unless the user requested one.

A skill cannot type a composer slash command on the user's behalf. Use the runtime's goal tools when exposed. If they are unavailable, run the same loop in the current turn and state that persistence across turns is not guaranteed.

Do not create a goal for an ordinary one-time PR status or review request that happened to trigger the skill implicitly.

## Authority and Boundaries

An explicit babysit request authorizes the routine mutations needed to satisfy this workflow on the PR's existing branch:

- Make minimal fixes for verified Codex findings or branch-caused CI failures.
- Add or update focused tests when the fix needs regression coverage.
- Commit and push those repairs without rewriting branch history.
- Reply to and resolve verified Codex automated review threads after their concern is addressed or shown not to apply.
- Retry a check once on an unchanged head when evidence identifies a transient infrastructure failure.

It does not authorize merging, approving, marking ready for review, changing the PR base, force-pushing, dismissing reviews, resolving human-authored threads, changing secrets, or performing production or deployment mutations. Obtain separate authorization for those actions.

Preserve unrelated local work. Use a clean isolated worktree at the exact PR head when the active checkout is dirty, belongs to another branch, or could be disrupted.

## Establish the Live State

At the beginning of every cycle:

- Refresh the PR's open/draft state, base and head refs, head SHA, mergeability, review decision, and check rollup. Fetch the exact refs before making repository-state claims.
- Query GitHub review threads through GraphQL, including thread IDs, resolution and outdated state, file and line anchors, comment authors, bodies, timestamps, and URLs. Flat PR comments are not sufficient for determining unresolved thread state.
- Treat a thread as Codex-generated only when its author or application metadata clearly identifies the configured Codex/OpenAI automated reviewer. Leave ambiguous or human-authored threads untouched and report them separately.
- Identify required checks and every relevant check running on the current head. Never reuse a green result from an older SHA.

If the PR is closed, merged, inaccessible, or does not have a safely writable branch, stop making changes and report the terminal condition or permission blocker.

## Reconciliation Loop

Repeat the following until the completion contract holds:

### Handle Codex Review Threads

For each unresolved in-scope thread, inspect the current code and surrounding behavior rather than trusting the thread's age or outdated marker.

- If the finding remains valid, make the smallest complete fix and run focused validation.
- If the current head already addresses it, or evidence shows it does not apply, reply with that concrete evidence.
- Resolve the thread only after the concern is addressed or rebutted. An outdated diff anchor alone is not proof of resolution.
- After any push, refresh the PR head and restart review-thread and CI evaluation from the new SHA.

Do not broaden a narrow finding into speculative cleanup. Group only changes that belong to the same verified repair.

### Drive CI to Green

Monitor checks on the current head. Treat queued, pending, in-progress, failed, timed-out, action-required, stale, and cancelled checks as non-green.

When a check fails:

1. Read the failing job and step logs.
2. Decide whether the failure is caused by the PR, a real base-branch problem, or transient infrastructure.
3. For a branch-caused failure, reproduce it when practical, make the narrowest fix, run the relevant local validation, commit, and push.
4. Retry only a verified transient failure, at most once per unchanged head. Do not repeatedly rerun an unchanged deterministic failure.

Use bounded waits or monitoring tools and refresh on state changes. Keep the user informed during long waits without producing repetitive unchanged updates.

### Recheck After Automation Settles

Do not assume the absence of current comments means automated review is finished. If the PR exposes a pending Codex review request, review job, or other repository-specific completion signal, wait for it. Once checks and review automation appear settled, take a fresh final snapshot; any new commit, thread, review, or check restarts the loop.

## Completion Contract

Complete successfully only when a final live read verifies all of the following against the same head SHA:

- The PR is still open and the head SHA is unchanged across the final verification.
- Every in-scope Codex automated review thread is resolved, and no current-head Codex review still requests changes.
- Every required check is successful or otherwise accepted by GitHub, every relevant head check is terminal, and none is failing, cancelled, or pending.
- All babysit repairs are committed and pushed, with no unpushed or unintended local changes.
- A final refresh after CI and review automation settled found no new work.

Human-authored unresolved threads are outside the default mutation scope. Report them clearly and do not claim the PR is globally review-complete; they block completion only when the user asked to resolve all reviewers' threads.

When the contract holds, mark an active goal complete and report the PR URL, verified head SHA, resolved Codex thread count, final check state, mutations made, and anything explicitly left out of scope. Never merge as part of this skill.

If progress requires new authority, a product decision, credentials, secrets, access to an external system, or a destructive operation, request that input instead of guessing. Keep an active goal open unless the goal runtime's blocked criteria are actually met.
