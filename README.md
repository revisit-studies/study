# reVISit study – Interactive, Web-Based User Studies.

Create your own interactive, web-based data visualization user studies by cloning/forking and editing configuration files and adding stimuli in the `public` folder.

reVISit introduces reVISit.spec a DSL for specifying study setups (consent forms, training, trials, etc) for interactive web based studies. You describe your experimental setup in reVISit.spec, add your stimuli as images, forms, html pages, or React components, build and deploy – and you're ready to run your study. For tutorials and documentation, see the [reVISit website](https://revisit.dev).

## Build Instructions

To run this demo experiment locally, you will need to install node on your computer.

- Clone `https://github.com/revisit-studies/study`
- Run `yarn install`. If you don't have yarn installed, run `npm i -g yarn`.
- To run locally, run `yarn serve`.
- Go to [http://localhost:8080](http://localhost:8080) to view it in your browser. The page will reload when you make changes.

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

When code changes are pushed to `dev` that affect public-facing APIs, configuration schemas, TypeScript types/interfaces, or component props, a GitHub Actions workflow automatically creates an issue in the documentation repository ([revisit-studies/reVISit-studies.github.io](https://github.com/revisit-studies/reVISit-studies.github.io)) to track documentation updates needed.

### How It Works

The [Documentation Sync workflow](.github/workflows/doc-sync.yml) is triggered on every push to `dev`:

1. **Extract changes**: Gets a git diff of changed files, filtering out noise (lock files, test files, build artifacts, etc.)
2. **Check relevance**: Reads the high-priority patterns in `.github/doc-coverage.md` and matches them against changed file paths
3. **Exit early if not relevant**: If no doc-relevant files changed, the workflow completes without creating an issue
4. **Create detailed issue**: If relevant files changed, creates an issue in the docs repo with:
   - Link to the compare view for the code changes
   - List of changed files
   - Link to the documentation coverage mapping
   - Clear instructions for Copilot on what needs to be updated
   - Link back to the triggering commit
5. **Assign to Copilot**: Assigns the issue to the `copilot` user
6. **Copilot takes over**: GitHub's Copilot coding agent automatically:
   - Analyzes the code changes and issue description
   - Reviews the documentation
   - Opens a pull request with suggested documentation updates

The quality of Copilot's output depends on the clarity of the issue description, so the workflow provides detailed context to guide the AI effectively.

### Maintaining Doc Coverage

The mapping of source code directories to documentation areas is defined in [`.github/doc-coverage.md`](.github/doc-coverage.md). This file uses file path patterns to determine which changes are document-relevant. When adding new source directories or major features:

1. Update `.github/doc-coverage.md` to include the new directory/feature
2. Add file patterns that should trigger documentation updates
3. Specify which documentation areas it affects (e.g., "Config Reference", "Component API")
4. The workflow will use these patterns to identify future doc-sync issues

### Configuration

Required GitHub secrets (set in repository settings):

- `DOCS_REPO_TOKEN`: GitHub personal access token with `issues:write` and `contents:write` permissions on the [revisit-studies/reVISit-studies.github.io](https://github.com/revisit-studies/reVISit-studies.github.io) repository. This token is used by the workflow to create issues and allow Copilot to create pull requests with documentation updates.
