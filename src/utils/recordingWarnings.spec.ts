import { describe, expect, test } from 'vitest';
import { getMutedInstruction, shouldMonitorMutedAudio } from './recordingWarnings';

describe('recordingWarnings', () => {
  test('only monitors muted audio on audio-enabled components', () => {
    expect(shouldMonitorMutedAudio(true, true)).toBe(true);
    expect(shouldMonitorMutedAudio(true, false)).toBe(false);
    expect(shouldMonitorMutedAudio(false, true)).toBe(false);
  });

  test('uses press-and-hold copy for click-to-record studies', () => {
    expect(getMutedInstruction(true)).toBe('Your microphone is muted. Press and hold the microphone icon to unmute.');
  });

  test('uses click-to-toggle copy for regular mute controls', () => {
    expect(getMutedInstruction(false)).toBe('Your microphone is muted. Click the microphone icon to unmute.');
  });
});
