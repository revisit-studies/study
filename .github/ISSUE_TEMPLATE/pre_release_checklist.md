---
name: Pre-release checklist
about: Track readiness for a reVISit release
title: 'Pre-release Checklist vX.Y.Z'
labels: QA
assignees: ''
---
# Pre-release Checklist vX.Y.Z

## Release Pull Request

- [ ] Confirm the release pull request targets `main`
- [ ] Confirm the pull request title exactly matches `vX.Y.Z`
- [ ] Confirm all required checks pass
- [ ] Confirm the pull request has the required approvals
- [ ] Confirm the release pull request preview deployed successfully
- [ ] Create and link the post-release checklist issue

## [Study Repository](https://github.com/revisit-studies/study)

### Run Studies

Run every study in `public/global.json`'s `configsList` through its expected end-to-end flow in the release pull request preview. Confirm each study reaches its expected completion or final state without an unexpected crash or error. When a study produces participant data, confirm its answers and completion status appear correctly in the analysis pages. Keep this list synchronized with `configsList` when studies are added or removed.

#### Demos

- [ ] `demo-html`
- [ ] `demo-html-input`
- [ ] `demo-form-elements`
- [ ] `demo-training`
- [ ] `demo-html-trrack`
- [ ] `demo-svelte-trrack`
- [ ] `demo-react-trrack`
- [ ] `demo-screen-recording`
- [ ] `demo-image`
- [ ] `demo-vega`
- [ ] `demo-video`
- [ ] `demo-dynamic`
- [ ] `demo-condition`
- [ ] `demo-style`
- [ ] `demo-yaml`
- [ ] `demo-ranking-widget`
- [ ] `demo-upset`
- [ ] `demo-choropleth-map`

#### Examples

- [ ] `example-VLAT-adaptive`
- [ ] `example-brush-interactions`
- [ ] `example-cleveland`
- [ ] `example-llm-chatbot`
- [ ] `example-mvnv`

#### Library Examples

- [ ] `library-adaptive-vlat`
- [ ] `library-beauvis`
- [ ] `library-berlin-num`
- [ ] `library-calvi`
- [ ] `library-color-blindness`
- [ ] `library-demographics`
- [ ] `library-graph-literacy-scale`
- [ ] `library-mic-check`
- [ ] `library-mini-vlat`
- [ ] `library-nasa-tlx`
- [ ] `library-previs`
- [ ] `library-quis`
- [ ] `library-sam`
- [ ] `library-screen-recording`
- [ ] `library-smeq`
- [ ] `library-sus`
- [ ] `library-ueq`
- [ ] `library-ueq-s`
- [ ] `library-umux`
- [ ] `library-umux-lite`
- [ ] `library-virtual-chinrest`
- [ ] `library-vlat`

#### Tests

- [ ] `test-audio`
- [ ] `test-component-timeout`
- [ ] `test-device-restriction`
- [ ] `test-library`
- [ ] `test-likert-matrix`
- [ ] `test-parser-errors`
- [ ] `test-randomization`
- [ ] `test-skip-logic`
- [ ] `test-step-logic`

#### Tutorial

- [ ] `tutorial`
- [ ] `tutorial-replication`

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

### Generated Files

- [ ] If parser types changed, regenerate the study config schemas using `yarn generate-schemas`
- [ ] If libraries changed, regenerate library docs and example studies using `yarn generate-library-docs` and `yarn generate-library-examples`

### Docs

- [ ] Update comments in `store/types.ts`, `parser/types.ts`, `storage/types.ts`, `storage/engines/types.ts`
- [ ] Update `typedocReadMe.md`
- [ ] Verify docs links in the [Study Repository](https://github.com/revisit-studies/study) are up to date and point to the current reVISit documentation pages

## [Documentation Repository](https://github.com/revisit-studies/reVISit-studies.github.io)

- [ ] Review docs
- [ ] Review [library list](https://revisit.dev/docs/designing-studies/plugin-libraries/)
- [ ] Check for typos
- [ ] Check for outdated docs
- [ ] Check for expired links
- [ ] Check the adoption Google Form for updated published papers
- [ ] Validate example code
- [ ] Update screenshots

## Cleanup and Sign-off

- [ ] Resolve or link all release-blocking issues
- [ ] Confirm the release is approved to merge
