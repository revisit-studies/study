---
name: Post-release checklist
about: Verify deployment and downstream updates after a reVISit release
title: 'Post-release Checklist vX.Y.Z'
labels: QA
assignees: ''
---
# Post-release Checklist vX.Y.Z

## [Study Repository](https://github.com/revisit-studies/study)

### Release Automation

- [ ] Confirm the `Release new version` workflow completed successfully
- [ ] Confirm the release commit and `vX.Y.Z` tag were created and version-pinned URLs reference the new tag
- [ ] Confirm the GitHub release was created and review the generated release notes
- [ ] Confirm the production deployment completed successfully
- [ ] Smoke test the production website

### Storage

- [ ] Run the Firebase cleanup in dry-run mode and review the planned deletions (`./scripts/clear-out-firebase.sh --include-dev --jobs 8`)
- [ ] Clear Firebase test data (`./scripts/clear-out-firebase.sh --include-dev --jobs 8 --execute`)

## [Documentation Repository](https://github.com/revisit-studies/reVISit-studies.github.io)

- [ ] Confirm the documentation deployment completed successfully
- [ ] Spot-check the live documentation and library list
- [ ] Remove old bug fix version

## [Template Repository](https://github.com/revisit-studies/template)

- [ ] Run the `Sync from Upstream` workflow with `upstream_ref` set to `vX.Y.Z`
- [ ] Confirm the deployment completed successfully
- [ ] Smoke test the deployed website

## [Replication Studies Repository](https://github.com/revisit-studies/replication-studies)

- [ ] Run the `Sync from Upstream` workflow with `upstream_ref` set to `vX.Y.Z`
- [ ] Confirm the deployment completed successfully
- [ ] Smoke test the deployed website

## [ReVISitPy Repository](https://github.com/revisit-studies/revisitpy)

- [ ] Confirm the `Create a new minor version and push to PyPi and GitHub` workflow completed successfully
- [ ] Confirm the new [`revisitpy`](https://pypi.org/project/revisitpy/) version is available on PyPI

## [ReVISitPy Server Repository](https://github.com/revisit-studies/revisitpy-server)

- [ ] Confirm the `Create a new version and push to PyPi and GitHub` workflow completed successfully
- [ ] Confirm the new [`revisitpy-server`](https://pypi.org/project/revisitpy-server/) version is available on PyPI

## TODOs

Create or link issues for any bugs found during post-release verification.
Add any other required follow-up tasks.

- [ ] ...
