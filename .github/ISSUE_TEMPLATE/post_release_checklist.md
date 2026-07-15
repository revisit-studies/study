---
name: Post-release checklist
about: Track follow-up after a reVISit release
title: 'Post-release Checklist vX.Y.Z'
labels: QA
assignees: ''
---
# Post-release Checklist vX.Y.Z

## [Study Repository](https://github.com/revisit-studies/study)

### Release Automation

- [ ] Confirm the `Release new version` workflow completed successfully
- [ ] Confirm the release commit and `vX.Y.Z` tag were created
- [ ] Confirm version-pinned repository and raw GitHub URLs reference `vX.Y.Z`
- [ ] Confirm the GitHub release was created with release notes
- [ ] Review the generated GitHub release notes for accuracy
- [ ] Confirm the production deployment completed successfully
- [ ] Confirm the production deployment is serving the release commit
- [ ] Smoke test the production study and analysis pages

### Storage

- [ ] Run `./scripts/clear-out-firebase.sh --include-dev --jobs 8` and review the planned deletions
- [ ] Confirm the Firebase project, prefixes, and studies are correct
- [ ] Clear Firebase test data (`./scripts/clear-out-firebase.sh --include-dev --jobs 8 --execute`)

## [Documentation Repository](https://github.com/revisit-studies/reVISit-studies.github.io)

- [ ] Check that the repo deployed
- [ ] Spot-check the live documentation and library list
- [ ] Remove old bug fix version

## [Template Repository](https://github.com/revisit-studies/template)

- [ ] Update the template repository by running the `sync-from-upstream` workflow
- [ ] Run the template repository and check for bugs

## [Replication Studies Repository](https://github.com/revisit-studies/replication-studies)

- [ ] Update the replication studies repository
- [ ] Run the replication studies repository and check for bugs

## [ReVISitPy Repository](https://github.com/revisit-studies/revisitpy)

- [ ] Confirm the downstream update workflow completed successfully

## [ReVISitPy Server Repository](https://github.com/revisit-studies/revisitpy-server)

- [ ] Confirm the downstream update workflow completed successfully

## Follow-up

- [ ] Create and link issues for any non-blocking problems found after release
- [ ] Confirm all post-release checks are complete
