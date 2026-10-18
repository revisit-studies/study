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

## Firebase App Check deployment

Firebase App Check keeps the existing reCAPTCHA v3 provider and `VITE_RECAPTCHAV3TOKEN` site key unless `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` is nonempty. Setting the Enterprise key selects `ReCaptchaEnterpriseProvider`. Both providers enable automatic token refresh. The main GitHub Pages publisher retains previous assets so open sessions can still load their original chunks during deployment; older assets require a separate cleanup after those sessions have ended. reCAPTCHA Enterprise is part of Google Cloud Fraud Defense.

### Migrate the existing Firebase app

1. In the same Google Cloud project, create a **score-based Web key** for your deployment domains (for the hosted app, `revisit.dev`). Enable the reCAPTCHA Enterprise API if prompted and leave checkbox challenges disabled.
2. Configure the existing Web app's **reCAPTCHA Enterprise** provider under Firebase Console → Security → App Check with that key. Preserve the existing v3 configuration and key so the live site and already-open browser sessions continue working. Verify both provider configurations remain registered before proceeding; do not change enforcement settings as part of the migration.
3. For this repository's GitHub Pages preview, set the repository variable `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY_PREVIEW` to the Enterprise site key and rebuild the PR preview. This variable affects PR previews and the `dev` deployment; production uses its separate variable. Test with a dedicated example study: previews share the Firebase project and study collections with production. Confirm Enterprise token exchange succeeds, Firestore reads/writes and Storage uploads work, and automatic refresh succeeds. A page loading or an upload succeeding without valid App Check tokens does not verify attestation when enforcement is off.
4. Merge into `dev` and validate the Enterprise deployment there before the next release. Leave the production Enterprise variable unset; `https://revisit.dev/study/` continues using v3. Releasing `dev` to `main` also keeps v3 until production is explicitly opted in.
5. Set the repository variable `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` to the verified Enterprise site key and rerun the Pages deployment on `main`. Verify `https://revisit.dev/study/` and App Check request metrics. Keep v3 registered for older deployments and open sessions.

For other deployments, set `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` in the build environment or `.env`, then rebuild/redeploy. It is a public site key, not a token or secret. Leave the legacy key configured for rollback. To roll back new clients to v3, clear the Enterprise variable and rebuild/redeploy; keep the Enterprise registration for already-open Enterprise sessions.

For local development, the app enables App Check debug mode. Register the debug token printed in the browser console in Firebase App Check; do not add `localhost` to the production reCAPTCHA key. Debug mode does not verify real Enterprise attestation.

See the [Firebase Enterprise App Check setup guide](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider). Google's [automatic Classic key migration](https://docs.cloud.google.com/recaptcha/docs/migration-overview) is separate from adopting the Enterprise App Check provider.

## Release Instructions

Releasing reVISit.dev happens automatically when a PR is merged into the `main` branch. The pull request title must exactly match the release version, e.g. `v1.0.0`. The release workflow updates version-pinned references, creates a release commit, and pushes a tag with the same name as the PR. Pushing the tag automatically creates the official GitHub release with generated release notes. The `main` branch is protected and requires two reviews before merging.

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
