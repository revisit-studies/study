---
name: Release checklist
about: Track readiness and follow-up for a ReVISit release
title: 'Release Checklist vX.Y.Z'
labels: ''
assignees: ''

---

## [Study Repository](https://github.com/revisit-studies/study)

**Studies**
- [ ] Review all studies for any crashes/bugs
- [ ] Check provenance data (audio, screen, etc.)

**File Download**
- [ ] JSON export
- [ ] Tidy download export
- [ ] Download audio recordings
- [ ] Download screen recordings
- [ ] Download provenance data
- [ ] Download configs

**Docs**
- [ ] Update comments in `store/types.ts`, `parser/types.ts`, `storage/types.ts`, `storage/engines/types.ts`
- [ ] Update `typedocReadMe.md`
- [ ] Verify docs links in the [Study Repository](https://github.com/revisit-studies/study) are up to date and point to the current reVISit documentation pages

## [Documentation Repository](https://github.com/revisit-studies/reVISit-studies.github.io)
- [ ] Review docs
- [ ] Review [library list](https://revisit.dev/docs/designing-studies/plugin-libraries/)
- [ ] Check for typos / outdated docs
- [ ] Validate example code
- [ ] Update screenshots

## [Template Repository](https://github.com/revisit-studies/template)
- [ ] Run the template update process so downstream study templates include the latest release changes

## [Replication Studies Repository](https://github.com/revisit-studies/replication-studies)
- [ ] Verify replication studies still run with the new release
- [ ] Update replication studies up-to-date
