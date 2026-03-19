import { describe, expect, test } from 'vitest';
import { StudyConfig } from '../parser/types';
import { getStudyRecordings } from './useStudyRecordings';

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

describe('getStudyRecordings', () => {
  test('returns false for all recording types when config is undefined', () => {
    expect(getStudyRecordings(undefined)).toEqual({
      hasAudioRecording: false,
      hasScreenRecording: false,
      hasWebcamRecording: false,
    });
  });

  test('detects webcam-only recording studies', () => {
    const studyConfig = createStudyConfig({
      uiConfig: {
        contactEmail: 'test@example.com',
        logoPath: 'logo.svg',
        withProgressBar: true,
        withSidebar: true,
        recordAudio: false,
        recordScreen: false,
        recordWebcam: true,
      },
    });

    expect(getStudyRecordings(studyConfig)).toEqual({
      hasAudioRecording: false,
      hasScreenRecording: false,
      hasWebcamRecording: true,
    });
  });

  test('detects component-level webcam recording alongside screen recording', () => {
    const studyConfig = createStudyConfig({
      uiConfig: {
        contactEmail: 'test@example.com',
        logoPath: 'logo.svg',
        withProgressBar: true,
        withSidebar: true,
        recordAudio: false,
        recordScreen: true,
        recordWebcam: false,
      },
      components: {
        webcamTrial: {
          type: 'markdown',
          path: 'test.md',
          response: [],
          recordWebcam: true,
        },
      },
    });

    expect(getStudyRecordings(studyConfig)).toEqual({
      hasAudioRecording: false,
      hasScreenRecording: true,
      hasWebcamRecording: true,
    });
  });
});
