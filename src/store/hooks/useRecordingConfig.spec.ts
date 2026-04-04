import { describe, expect, test } from 'vitest';
import { StudyConfig } from '../../parser/types';
import { getStudyRecordingConfig } from './recordingConfigUtils';

function createStudyConfig(overrides?: Partial<StudyConfig>): StudyConfig {
  return {
    uiConfig: {
      contactEmail: 'test@example.com',
      logoPath: 'logo.svg',
      withProgressBar: true,
      withSidebar: true,
      recordAudio: false,
      recordScreen: false,
      recordWebcam: false,
    },
    components: {},
    sequence: {
      order: 'fixed',
      components: [],
    },
    ...overrides,
  } as StudyConfig;
}

describe('getStudyRecordingConfig', () => {
  test('detects independent webcam recording from a component override', () => {
    const studyConfig = createStudyConfig({
      components: {
        intro: {
          type: 'markdown',
          path: 'test.md',
          response: [],
        },
        webcamTrial: {
          type: 'markdown',
          path: 'test.md',
          response: [],
          recordWebcam: true,
        },
      },
    });

    expect(getStudyRecordingConfig(['intro', 'webcamTrial'], studyConfig)).toEqual({
      studyHasAudioRecording: false,
      studyHasScreenRecording: false,
      studyHasWebcamRecording: true,
    });
  });

  test('detects mixed screen, audio, and webcam recording without coupling webcam to screen', () => {
    const studyConfig = createStudyConfig({
      uiConfig: {
        contactEmail: 'test@example.com',
        logoPath: 'logo.svg',
        withProgressBar: true,
        withSidebar: true,
        recordAudio: true,
        recordScreen: false,
        recordWebcam: true,
      },
      components: {
        screenTrial: {
          type: 'markdown',
          path: 'test.md',
          response: [],
          recordScreen: true,
        },
      },
    });

    expect(getStudyRecordingConfig(['screenTrial'], studyConfig)).toEqual({
      studyHasAudioRecording: true,
      studyHasScreenRecording: true,
      studyHasWebcamRecording: true,
    });
  });
});
