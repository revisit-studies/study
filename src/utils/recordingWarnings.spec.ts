import { describe, expect, test } from 'vitest';
import {
  getMutedInstruction,
  getRmsLevel,
  isSpeakingAtLevel,
  shouldMonitorMutedAudio,
} from './recordingWarnings';

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

  test('computes RMS level from time-domain samples', () => {
    const samples = new Float32Array([0.02, -0.02, 0.02, -0.02]);

    expect(getRmsLevel(samples)).toBeCloseTo(0.02);
  });

  test('uses a higher threshold to start speaking than to continue it', () => {
    expect(isSpeakingAtLevel(0.015, false)).toBe(false);
    expect(isSpeakingAtLevel(0.015, true)).toBe(true);
    expect(isSpeakingAtLevel(0.005, true)).toBe(false);
  });
});
