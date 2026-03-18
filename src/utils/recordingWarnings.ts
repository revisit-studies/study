export function shouldMonitorMutedAudio(isMuted: boolean, currentComponentHasAudioRecording: boolean) {
  return isMuted && currentComponentHasAudioRecording;
}

export function getMutedInstruction(clickToRecord: boolean) {
  return clickToRecord
    ? 'Your microphone is muted. Press and hold the microphone icon to unmute.'
    : 'Your microphone is muted. Click the microphone icon to unmute.';
}
