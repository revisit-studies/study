# ReVISit study – Interactive, Web-Based User Studies.

ReVISit introduces reVISit.spec, a DSL for specifying study setups (consent forms, training, trials, etc.) for interactive web-based studies. You describe your experimental setup in reVISit.spec, add your stimuli as images, forms, HTML pages, or React components, build and deploy — and you're ready to run your study. For tutorials and documentation, see the [reVISit website](https://revisit.dev).

Create your own interactive, web-based data visualization by starting from the [template repository](https://github.com/revisit-studies/template) that tracks the stable version of this repository but removes unnecessary code baggage. Check out the [installation documentation](https://revisit.dev/docs/getting-started/installation/) for details.

## Paper

If you are using reVISit for a paper, please cite:

> Zach Cutler, Jack Wilburn, Hilson Shrestha, Yiren Ding, Brian Bollen, Khandaker Abrar Nadib, Tingying He, Andrew McNutt, Lane Harrison, Alexander Lex. [ReVISit 2: A Full Experiment Life Cycle User Study Framework](https://www.visdesignlab.net/publications/2025_vis_revisit/). IEEE Transactions on Visualization and Computer Graphics (VIS), 32(1): 13-23, [doi:10.1109/TVCG.2025.3633896](https://dx.doi.org/10.1109/TVCG.2025.3633896), 2026.

**IEEE VIS 2025 Best Paper Award**

GitHub citation metadata for this repository is available in [CITATION.cff](./CITATION.cff).

## Build Instructions

To run this demo experiment locally, you will need to install Node.js on your computer.

* Clone `https://github.com/revisit-studies/study`
* Run `yarn install`. If you don't have Yarn installed, run `npm i -g yarn`.
* To run locally, run `yarn serve`.
* Go to [http://localhost:8080](http://localhost:8080) to view it in your browser. The page will reload when you make changes.

## Self-hosted Supabase

See [first-time setup](supabase/README.md) and the [migration guide](supabase/MIGRATION.md) for a version-pinned upstream Supabase deployment. Existing MinIO or pgsty-backed installations must migrate before starting the new configuration.

## Adding Tests

This repo uses two test types:

* **Unit tests** with **Vitest** for parser, utility, and component logic.
* **End-to-end (E2E) tests** with **Playwright** for participant/designer flows in a running app.

### Unit tests (Vitest)

* Place unit tests in a sibling `tests/` folder next to the source file they cover.
* Use the same base filename and add `.spec.` (for example: `src/parser/parser.ts` -> `src/parser/tests/parser.spec.ts`).
* Use `vitest` APIs (`describe`, `test`/`it`, `expect`).
* Run unit tests with:

```bash
yarn unittest
```

### E2E tests (Playwright)

* Put E2E tests in the root `tests/` directory.
* Name files with `.spec.ts` (for example: `tests/demo-vlat.spec.ts`).
* Keep tests focused on user-observable behavior (navigation, input, progression, reviewer/designer behavior).
* Run E2E tests with:

```bash
yarn test
```

## Release Instructions

The root `VERSION` file is the source of truth for the application version. On `dev`, update it manually with a `-dev` suffix and run `node scripts/release-version.mjs sync dev` to synchronize package metadata and current-release schema and source pointers. CI validates this state but does not update `dev`. On `main`, the release workflow reads `VERSION` from the merged release PR, removes the `-dev` suffix to set the stable version, and updates its pointers.

Releasing reVISit.dev happens automatically when a release PR is merged into the `main` branch. The pull request title must exactly match the version in `VERSION` without `-dev`, e.g. `VERSION` set to `X.Y.Z-dev` requires a title of `vX.Y.Z`. CI checks on the release PR that this version is strictly higher than the latest stable release tag. The release workflow updates current-release pointers, creates a release commit, and pushes a tag with that version. The Pages workflow skips the intermediate `-dev` merge commit and deploys after the stable release commit is pushed. Pushing the tag automatically creates the official GitHub release with generated release notes. The `main` branch is protected and requires two reviews before merging.

The workflow for release looks as follows:
Develop features on feature branch
| PRs
Dev branch
| PR (1 per release)
Main branch
| Run release workflow on merge
References are updated, and a release commit and tag are pushed
| Tag push and repository dispatch events
GitHub release is created and downstream builds are triggered
