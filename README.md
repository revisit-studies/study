# reVISit study – Interactive, Web-Based User Studies.  

Create your own interactive, web-based data visualization user studies by cloning/forking and editing configuration files and adding stimuli in the `public` folder. 

reVISit introduces reVISit.spec a DSL for specifying study setups (consent forms, training, trials, etc) for interactive web based studies. You describe your experimental setup in reVISit.spec, add your stimuli as images, forms, html pages, or React components, build and deploy – and you're ready to run your study. For tutorials and documentation, see the [reVISit website](https://revisit.dev). 

## Build Instructions

To run this demo experiment locally, you will need to install node on your computer. 

* Clone `https://github.com/revisit-studies/study`
* Run `yarn install`. If you don't have yarn installed, run `npm i -g yarn`. 
* To run locally, run `yarn serve`.
* Go to [http://localhost:8080](http://localhost:8080) to view it in your browser. The page will reload when you make changes. 

## Adding Tests

This repo uses two test types:

* **Unit tests** with **Vitest** for parser, utility, and component logic.
* **End-to-end (E2E) tests** with **Playwright** for participant/designer flows in a running app.

### Unit tests (Vitest)

* Co-locate unit tests with the source file they cover.
* Use the same base filename and add `.spec.` (for example: `src/parser/parser.ts` -> `src/parser/parser.spec.ts`).
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

Releasing reVISit.dev happens automatically when a PR is merged into the `main` branch. The name of the pull request should be the title of the release, e.g. `v1.0.0`. Releasing creates a tag with the same name as the PR, but the official GitHub release should be created manually. The `main` branch is protected and requires two reviews before merging.

The workflow for release looks as follows:
Develop features on feature branch
| PRs
Dev branch
| PR (1 per release)
Main branch
| Run release workflow on merge
References are updated and commit is tagged

### Release Follow-Up

- [ ] Verify docs links in the [Study Repository](https://github.com/revisit-studies/study) are up to date and point to the current reVISit documentation pages.
- [ ] After the release is complete, run the template update process so downstream study templates include the latest release changes.


## QC Checklist

### [Study Repository](https://github.com/revisit-studies/study)

**Studies**
- [ ] Review all studies for any crashes/bugs
- [ ] Check provenance data (audio, screen, etc.)

**File Download**
- [ ] JSON export
- [ ] Tidy download export
- [ ] Download audio recordings
- [ ] Download screen recordings
- [ ] Download configs

**Docs**
- [ ] Update comments in `store/types.ts`, `parser/types.ts`, `storage/types.ts`, `storage/engines/types.ts`
- [ ] Update `typedocReadMe.md`

### [Documentation Repository](https://github.com/revisit-studies/reVISit-studies.github.io)
- [ ] Review docs
- [ ] Review [library list](https://revisit.dev/docs/designing-studies/plugin-libraries/)
- [ ] Check for typos / outdated docs
- [ ] Validate example code
- [ ] Update screenshots
