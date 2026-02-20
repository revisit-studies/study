# reVISit study – Interactive, Web-Based User Studies.  

Create your own interactive, web-based data visualization user studies by cloning/forking and editing configuration files and adding stimuli in the `public` folder. 

reVISit introduces reVISit.spec a DSL for specifying study setups (consent forms, training, trials, etc) for interactive web based studies. You describe your experimental setup in reVISit.spec, add your stimuli as images, forms, html pages, or React components, build and deploy – and you're ready to run your study. For tutorials and documentation, see the [reVISit website](https://revisit.dev). 

## Build Instructions

To run this demo experiment locally, you will need to install node on your computer. 

* Clone `https://github.com/revisit-studies/study`
* Run `yarn install`. If you don't have yarn installed, run `npm i -g yarn`. 
* To run locally, run `yarn serve`.
* Go to [http://localhost:8080](http://localhost:8080) to view it in your browser. The page will reload when you make changes. 

## Release Instructions

Releasing reVISit.dev happens automatically when a PR is merged into the `main` branch. The name of the pull request should be the title of the release, e.g. `v1.0.0`. Releasing creates a tag with the same name as the PR, but the official GitGub release should be created manually. The `main` branch is protected and requires two reviews before merging.

The workflow for release looks as follows:
Develop features on feature branch
| PRs
Dev branch
| PR (1 per release)
Main branch
| Run release workflow on merge
References are updated and commit is tagged

## Documentation Synchronization

When code changes are merged to `main` that affect public-facing APIs, configuration schemas, TypeScript types/interfaces, or component props, a GitHub Actions workflow automatically creates an issue in the documentation repository ([revisit-studies/reVISit-studies.github.io](https://github.com/revisit-studies/reVISit-studies.github.io)) to track documentation updates needed.

### How It Works

The [Documentation Sync workflow](.github/workflows/doc-sync.yml) is triggered on every push to `main`:

1. **Extract changes**: Gets a git diff of changed files, filtering out noise (lock files, test files, build artifacts, etc.)
2. **Analyze with AI**: Passes the diff to Claude AI with context about which source directories map to which documentation areas
3. **Determine relevance**: Claude determines if the changes require documentation updates
4. **Create issue**: If relevant, an issue is automatically created in the docs repo with:
   - Summary of what changed
   - Which documentation areas are affected
   - Specific suggestions for what to update
   - Severity level (low/medium/high)
   - Link back to the triggering commit

### Maintaining Doc Coverage

The mapping of source code directories to documentation areas is defined in [`.github/doc-coverage.md`](.github/doc-coverage.md). When adding new source directories or major features:

1. Update `.github/doc-coverage.md` to include the new directory/feature
2. Specify which documentation areas it affects (e.g., "Config Reference", "Component API")
3. Note which types of changes are always, usually, or rarely documentation-relevant
4. The workflow will use this mapping to accurately route future doc-sync issues

### Configuration

Required GitHub secrets (set in repository settings):
- `ANTHROPIC_API_KEY`: API key for Claude AI (used to analyze code changes)
- `DOCS_REPO_TOKEN`: GitHub personal access token with `issues:write` permission on the docs repository

The workflow itself is graceful – if the API call fails or returns invalid data, it logs a warning but doesn't block deployment.