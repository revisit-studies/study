export function shouldMonitorMutedAudio(isMuted: boolean, currentComponentHasAudioRecording: boolean) {
  return isMuted && currentComponentHasAudioRecording;
}

export const SPEAKING_RMS_THRESHOLD = 0.02;
export const SPEAKING_RMS_CLEAR_THRESHOLD = 0.01;
export const SPEECH_DETECTION_HOLD_MS = 250;

export function getRmsLevel(timeDomainData: Float32Array) {
  if (timeDomainData.length === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < timeDomainData.length; i += 1) {
    const sample = timeDomainData[i];
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / timeDomainData.length);
}

export function isSpeakingAtLevel(rmsLevel: number, wasSpeaking: boolean) {
  return rmsLevel >= (wasSpeaking ? SPEAKING_RMS_CLEAR_THRESHOLD : SPEAKING_RMS_THRESHOLD);
}

export function getMutedInstruction(clickToRecord: boolean) {
  return clickToRecord
    ? 'Your microphone is muted. Press and hold the microphone icon to unmute.'
    : 'Your microphone is muted. Click the microphone icon to unmute.';
}
