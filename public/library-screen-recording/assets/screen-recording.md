# Screen Recording

This is a demo of the library `screen-recording`.

Use this library's permission component when a study records a participant's screen. It requests access to screen capture and any configured webcam or microphone recording, then starts the configured recordings. For webcam-only recording, use the `webcam-recording` library instead.

## Available Components

- screenRecordingPermission

## Available Sequences

None

## Additional Description

The `screenRecordingPermission` component is required before any screen recording begins. It also handles webcam permission for combined screen and webcam studies, and includes a microphone check when audio recording is enabled. See [Record Screen and Webcam](https://revisit.dev/docs/designing-studies/record-screen/) for setup and participant permission details.
