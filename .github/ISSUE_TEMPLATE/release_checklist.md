---
name: Release checklist
about: Track readiness and follow-up for reVISit release
title: 'Release Checklist vX.Y.Z'
labels: QA
assignees: ''

---

# Release Checklist vX.Y.Z

## [Study Repository](https://github.com/revisit-studies/study)

### Run Studies
Check for crashes or bugs
- [ ] `demo-html`
- [ ] `demo-form-elements`
- [ ] `demo-training`
- [ ] `demo-screen-recording`
- [ ] `demo-image`
- [ ] `demo-vega`
- [ ] `demo-video`
- [ ] `demo-dynamic`
- [ ] `demo-condition`
- [ ] `demo-style`
- [ ] `demo-upset`
- [ ] `example-brush-interactions`
- [ ] `example-llm-chatbot`
- [ ] `test-device-restriction`
- [ ] `test-component-timeout`
- [ ] `test-skip-logic`
- [ ] `test-step-logic`
- [ ] `library-nasa-tlx`
- [ ] `library-smeq`
- [ ] `library-virtual-chinrest`

### Analysis Pages
- [ ] Study Summary
    - [ ] Filter works correctly
    - [ ] Statistics look correct
- [ ] Participant View
    - [ ] Filter works correctly
    - [ ] Reject / Undo reject participant works correctly
    - [ ] Replay timeline looks correct
- [ ] Replay
    - [ ] Replay works correctly at different play speeds
    - [ ] Check provenance data (audio, screen, etc.)
    - [ ] Navigate to the next and previous participant IDs
    - [ ] Add participant tags
    - [ ] Navigate to the next and previous participant tasks
    - [ ] Add task tags
    - [ ] Load transcripts (studies with audio e.g. `demo-screen-recording`)
    - [ ] Download audio/screen recordings (e.g. `demo-screen-recording`)
    - [ ] Reject / Undo reject participant works correctly
- [ ] Trial Stats
    - [ ] Filter works correctly
    - [ ] Overview stats look correct
    - [ ] Vega stimulus for answers looks correct
- [ ] Coding
    - [ ] Filter works correctly
    - [ ] Add text tags
    - [ ] Add annotations
    - [ ] Replay works correctly at different play speeds
    - [ ] Navigate to the next and previous participant IDs
    - [ ] Add participant tags
    - [ ] Navigate to the next and previous participant tasks
    - [ ] Add task tags
    - [ ] Load transcripts (studies with audio e.g. `demo-screen-recording`)
    - [ ] Download audio/screen recordings (e.g. `demo-screen-recording`)
    - [ ] Reject / Undo reject participant works correctly
- [ ] Live Monitor
    - [ ] Filter works correctly
    - [ ] Check participant count header
    - [ ] Check live monitor tracker
- [ ] Config
    - [ ] Download configs (by selecting from the table) / Download config (single download from actions column)
    - [ ] Compare configs
    - [ ] View config
- [ ] Manage
    - [ ] Changing ReVISit Modes updates the study card and study browser
    - [ ] Add a new stage and edit stage color
    - [ ] Create a data snapshot
- [ ] File download
    - [ ] JSON export
    - [ ] Tidy download export
    - [ ] Download audio recordings
    - [ ] Download screen recordings
    - [ ] Download provenance data
- [ ] Change config from the config dropdown
- [ ] Click Go to study and confirm it opens the study

### Storage
- [ ] Clear Firebase test data

### Generated Files
- [ ] If parser types changed, regenerate the study config schemas using `yarn generate-schemas`
- [ ] If libraries changed, regenerate library docs and example studies using `yarn generate-library-docs` and `yarn generate-library-examples`

### Docs
- [ ] Update comments in `store/types.ts`, `parser/types.ts`, `storage/types.ts`, `storage/engines/types.ts`
- [ ] Update `typedocReadMe.md`
- [ ] Verify docs links in the [Study Repository](https://github.com/revisit-studies/study) are up to date and point to the current reVISit documentation pages

## [Documentation Repository](https://github.com/revisit-studies/reVISit-studies.github.io)
- [ ] Check that the repo deployed
- [ ] Review docs
- [ ] Review [library list](https://revisit.dev/docs/designing-studies/plugin-libraries/)
- [ ] Check for typos
- [ ] Check for outdated docs
- [ ] Check for expired links
- [ ] Check the adoption Google Form for updated published papers
- [ ] Validate example code
- [ ] Update screenshots
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
