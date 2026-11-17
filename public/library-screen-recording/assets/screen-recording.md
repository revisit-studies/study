# Screen Recording

This is a demo of the library `screen-recording`.

Use this library's permission component when a study records a participant's screen. It requests access to screen capture and any configured webcam or microphone recording, then starts the configured recordings. For webcam-only recording, use the `webcam-recording` library instead.

## Available Components

- screenRecordingPermission

## Available Sequences

None

## Additional Description

The `screenRecordingPermission` component is required before any screen recording begins. It also handles webcam permission for combined screen and webcam studies, and includes a microphone check when audio recording is enabled. See [Record Screen and Webcam](https://revisit.dev/docs/designing-studies/record-screen/) for setup and participant permission details.

For studies that require participants to share an entire monitor, set `uiConfig.requireEntireScreen` to `true` alongside `uiConfig.recordScreen: true`. This verifies the browser's reported capture source, blocks recorded tasks when whole-monitor capture cannot be verified, and records page focus, visibility, pointer, and display-count markers for replay. Browser support for reporting the capture source and detecting attached displays varies.
