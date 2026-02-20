# Documentation Coverage Mapping

This file maps ReVISit source code directories and file patterns to documentation areas. It helps the documentation sync workflow identify which doc pages might be affected by code changes.

## Source Directory Mapping

### Configuration & Schema
- **Path:** `src/parser/types.ts`, `src/parser/`
- **Docs Areas:** 
  - Config Reference
  - Study Configuration Guide
  - Component Configuration Reference
- **Description:** TypeScript types and interfaces that define the study config schema, component configuration, and run sequence parameters. Changes here directly affect study configuration documentation and example configs.

### Component API & Props
- **Path:** `src/components/`, `src/components/**/*.tsx`
- **Docs Areas:**
  - Component API Reference
  - Component Library
  - Custom Component Guide
- **Description:** React components that are exposed as part of the public API for study designers. Changes to component props, interfaces, or exported components should be reflected in component documentation.

### Data Storage & Types
- **Path:** `src/store/types.ts`, `src/storage/`
- **Docs Areas:**
  - Data Export Reference
  - Storage Configuration
  - Participant Data Schema
- **Description:** Type definitions for stored data, participant responses, and metadata. Changes here affect documentation on data export formats and what information is captured.

### Utility Functions
- **Path:** `src/utils/`, `src/utils/**/*.ts`
- **Docs Areas:**
  - Utility Functions Reference
  - Helper Library Guide
- **Description:** Exported utility functions and helper libraries available to study implementations. New utilities or modifications to function signatures should be documented.

### Study Configuration Parser
- **Path:** `src/parser/`, `GlobalConfigParser.tsx`
- **Docs Areas:**
  - Config Reference
  - Study Setup Guide
  - Global Configuration
- **Description:** Parser logic and configuration loading. Major changes might affect how configs are structured or validated.

### Analysis Tools & Features
- **Path:** `src/analysis/`
- **Docs Areas:**
  - Data Analysis Guide
  - Analysis Tools Reference
- **Description:** Analysis utilities and features for researchers reviewing study data and results.

### User Authentication & Routes
- **Path:** `src/routes/`, `ProtectedRoute.tsx`, `Login.tsx`
- **Docs Areas:**
  - Authentication Guide
  - User Roles & Permissions
- **Description:** Authentication methods and route definitions. Major changes to auth flows or user roles should be documented.

### Storage Engines
- **Path:** `src/storage/`
- **Docs Areas:**
  - Storage Configuration
  - Storage Engine Reference
  - Firebase/Supabase Setup
- **Description:** Storage backend implementations. Changes to supported storage engines or configuration options need documentation updates.

## File Pattern Definitions

### High-Priority Changes (Always doc-relevant)
- Changes to exported interfaces/types in `src/parser/types.ts`
- Changes to study config schema validation
- Changes to component props interfaces
- Addition/removal of exported components
- Changes to data export formats
- New storage engine implementations

### Medium-Priority Changes (Likely doc-relevant)
- Public utility function changes/additions
- Authentication flow modifications
- New analysis features
- Configuration parameter additions
- Data storage schema changes

### Low-Priority Changes (Possibly doc-relevant)
- Internal refactoring of private functions
- UI/styling changes in admin/reviewer UI
- Performance optimizations
- Internal state management restructuring

### No Documentation Update Needed
- Test file changes (*.spec.ts, *.test.ts)
- Build configuration (vite.config.ts, tsconfig.json)
- Linting configuration (.eslintrc, eslint.config.js)
- Lock files (package-lock.json, yarn.lock)
- Library assets in public/libraries/
- Internal development tools
- CI/CD configuration (.github/ workflows)

## How to Update This File

When adding new source directories or major features:
1. Identify the primary documentation area(s) the code affects
2. Note which file patterns should trigger documentation updates
3. Add the mapping to this file under the appropriate section
4. Consider whether changes are always, usually, or rarely documentation-relevant

When removing features:
- Note in the removed features section of documentation
- Remove the corresponding mapping from this file if the directory is deleted
