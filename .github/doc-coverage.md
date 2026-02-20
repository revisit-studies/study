# Documentation Coverage Mapping

This file helps the documentation sync workflow identify which code changes are documentation-relevant. The workflow matches changed file paths against the patterns defined below to determine whether to create a documentation sync issue.

## How the Workflow Uses This File

The documentation sync workflow:
1. Extracts a git diff of changed files
2. Matches file paths against the high-priority patterns below
3. If any changed files match a high-priority pattern, creates an issue in the docs repo
4. Assigns the issue to the `copilot` user for documentation updates

**To trigger documentation sync, changed files must match at least one of the high-priority file patterns** defined in the next section.

## High-Priority File Patterns (Always Doc-Relevant)

These patterns trigger documentation sync issues when files matching them change:

- `src/parser/types.ts` — Study config schema, component config, and type definitions
- `src/components/` — React component props and exported component interfaces
- `src/store/types.ts` — Participant data types and storage schemas
- `src/storage/` — Storage engine implementations and backends

When any file matching these patterns is modified, the workflow assumes documentation updates are needed and creates an issue for Copilot to handle.

## Documentation Areas and Their Source Files

This section provides context for Copilot and reviewers on which doc pages should be updated based on which files changed.

### Configuration & Schema

- **Files:** `src/parser/types.ts`, `src/parser/`
- **Doc Areas:**
  - Config Reference
  - Study Configuration Guide
  - Component Configuration Reference
- **When to update:** Changes to exported interfaces, new config fields, removed/renamed config properties

### Component API & Props

- **Files:** `src/components/`, component prop interfaces
- **Doc Areas:**
  - Component API Reference
  - Component Library
  - Custom Component Guide
- **When to update:** New components, changed component props, new/changed event handlers or callbacks

### Data Storage & Participant Data

- **Files:** `src/store/types.ts`, `src/storage/`
- **Doc Areas:**
  - Data Export Reference
  - Storage Configuration
  - Participant Data Schema
- **When to update:** Changes to data structure, new fields in participant responses, storage engine changes

### Utility Functions

- **Files:** `src/utils/`, helper functions
- **Doc Areas:**
  - Utility Functions Reference
  - Helper Library Guide
- **When to update:** New exported utilities, changed function signatures, new helper functions

### Analysis Tools

- **Files:** `src/analysis/`
- **Doc Areas:**
  - Data Analysis Guide
  - Analysis Tools Reference
- **When to update:** New analysis features, changed analysis outputs or interfaces

### User Authentication & Access Control

- **Files:** `src/routes/`, `ProtectedRoute.tsx`, `Login.tsx`
- **Doc Areas:**
  - Authentication Guide
  - User Roles & Permissions
- **When to update:** Auth flow changes, new user roles, permission model changes

## File Pattern Definitions

### What Triggers a Doc Sync Issue

The workflow creates an issue when **any** of these file patterns are changed:

1. **`src/parser/types.ts`** — Changes to config schema types
2. **`src/components/`** — Changes to component code (any file under this directory)
3. **`src/store/types.ts`** — Changes to data types
4. **`src/storage/`** — Changes to storage implementations (any file under this directory)

If a commit touches one or more of these files, an issue is automatically created in the docs repo and assigned to Copilot.

### What Does NOT Trigger Doc Sync

These files are excluded from triggering documentation sync (filtered out of git diff):

- **Test files:** `*.spec.ts`, `*.test.ts`
- **Build configuration:** `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`
- **Linting configuration:** `.eslintrc*`, `eslint.config.js`
- **Lock files:** `package-lock.json`, `yarn.lock`, `.yarn/**`
- **Build artifacts:** `dist/`, `build/`, `node_modules/`
- **Library assets:** `public/libraries/**`, `public/**/assets/**`
- **Markdown docs:** `**.md`
- **CI/CD workflows:** `.github/` (internal GitHub Actions files)

## Maintaining This File

When the codebase evolves and new documentation-relevant areas are added:

### Adding a New High-Priority Pattern

1. **Identify the new code area** that should trigger docs updates (e.g., a new `src/features/` directory)
2. **Add the pattern** to the high-priority list at the top of this section
3. **Document the pattern** by adding a section explaining:
   - Which files/directories match the pattern
   - What they contain and why they're documentation-relevant
   - Which doc pages should be updated when this code changes
4. **Commit the change** — future pushes with changes to that pattern will now trigger documentation sync

### Example: Adding a New Feature Area

If you create a new `src/hooks/` directory for custom React hooks that should have documented APIs:

1. Add `src/hooks/` to the high-priority patterns in the workflow
2. Add a section here documenting:
   ```
   ### Custom React Hooks
   
   - **Files:** `src/hooks/`
   - **Doc Areas:**
     - Custom Hooks Reference
     - Hook Usage Guide
   - **When to update:** New exported hooks, changed hook parameters or return values
   ```

This ensures that anyone modifying exported hooks will trigger documentation sync.

## How to Update the Workflow When Patterns Change

To modify which files trigger documentation sync, edit the high-priority patterns in [`.github/workflows/doc-sync.yml`](.github/workflows/doc-sync.yml):

Look for the `HIGH_PRIORITY_PATTERNS` array in the "Check if changes are doc-relevant" step and update the patterns to match your new structure.

When removing features:

- Note in the removed features section of documentation
- Remove the corresponding mapping from this file if the directory is deleted
