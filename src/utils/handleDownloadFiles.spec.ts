import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { StorageEngine } from '../storage/engines/types';
import type { StudyConfig } from '../parser/types';
import {
  downloadConfigFile,
  downloadConfigFilesZip,
  downloadParticipantsAudioZip,
  handleTaskAudio,
  handleTaskScreenRecording,
} from './handleDownloadFiles';

// Stub browser APIs that jsdom does not implement
const mockUrl = 'blob:mock-object-url';

const makeStorageEngine = (overrides: Partial<Record<string, unknown>> = {}) => ({
  getAudioUrl: vi.fn(async () => null),
  getTranscriptUrl: vi.fn(async () => null),
  getScreenRecording: vi.fn(async () => null),
  ...overrides,
} as Partial<StorageEngine> as StorageEngine);

let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // jsdom doesn't implement createObjectURL / revokeObjectURL
  URL.createObjectURL = vi.fn(() => mockUrl);
  URL.revokeObjectURL = vi.fn();
  // Prevent real anchor-click side effects
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  // Default fetch stub – returns a small blob
  vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['data'], { type: 'application/octet-stream' }) })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  clickSpy.mockRestore();
});

describe('handleTaskAudio', () => {
  test('fetches the provided audioUrl and triggers a download click', async () => {
    const storageEngine = makeStorageEngine();
    await handleTaskAudio({
      storageEngine,
      participantId: 'p1',
      identifier: 'trial_0',
      audioUrl: 'https://example.com/audio.webm',
    });

    // storageEngine.getAudioUrl should NOT be called when audioUrl is given
    expect((storageEngine.getAudioUrl as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });

  test('calls storageEngine.getAudioUrl when no audioUrl is provided', async () => {
    const audioUrl = 'https://example.com/fetched-audio.webm';
    const storageEngine = makeStorageEngine({
      getAudioUrl: vi.fn(async () => audioUrl),
    });

    await handleTaskAudio({ storageEngine, participantId: 'p2', identifier: 'trial_1' });

    expect((storageEngine.getAudioUrl as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('trial_1', 'p2');
    expect(clickSpy).toHaveBeenCalled();
  });

  test('downloads transcript when getTranscriptUrl returns a URL', async () => {
    const storageEngine = makeStorageEngine({
      getAudioUrl: vi.fn(async () => null),
      getTranscriptUrl: vi.fn(async () => 'https://example.com/transcript.txt'),
    });

    await handleTaskAudio({ storageEngine, participantId: 'p3', identifier: 'trial_2' });

    // click once for transcript
    expect(clickSpy).toHaveBeenCalled();
  });

  test('skips download when audio and transcript URLs are both null', async () => {
    const storageEngine = makeStorageEngine();
    await handleTaskAudio({ storageEngine, participantId: 'p4', identifier: 'trial_3' });

    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe('handleTaskScreenRecording', () => {
  test('fetches the provided screenRecordingUrl and triggers a click', async () => {
    const storageEngine = makeStorageEngine();
    await handleTaskScreenRecording({
      storageEngine,
      participantId: 'p1',
      identifier: 'trial_0',
      screenRecordingUrl: 'https://example.com/recording.webm',
    });

    expect((storageEngine.getScreenRecording as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  test('calls storageEngine.getScreenRecording when no URL is provided', async () => {
    const storageEngine = makeStorageEngine({
      getScreenRecording: vi.fn(async () => 'https://example.com/rec.webm'),
    });

    await handleTaskScreenRecording({ storageEngine, participantId: 'p2', identifier: 'trial_1' });

    expect((storageEngine.getScreenRecording as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('trial_1', 'p2');
    expect(clickSpy).toHaveBeenCalled();
  });

  test('skips download when screen recording URL is null', async () => {
    const storageEngine = makeStorageEngine();
    await handleTaskScreenRecording({ storageEngine, participantId: 'p3', identifier: 'trial_2' });
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe('downloadConfigFile', () => {
  test('creates a JSON blob from the config and triggers a download click', async () => {
    const config = {} as StudyConfig;

    await downloadConfigFile({ studyId: 'my-study', hash: 'abc123', config });

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });
});

describe('downloadConfigFilesZip', () => {
  test('creates a zip containing one JSON file per matching hash and downloads it', async () => {
    const config = {} as StudyConfig;

    await downloadConfigFilesZip({
      studyId: 'zip-study',
      configs: [{ hash: 'h1', config }, { hash: 'h2', config }],
      hashes: ['h1'],
    });

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  test('skips entries whose hash is not in the hashes list', async () => {
    const config = {} as StudyConfig;

    await downloadConfigFilesZip({
      studyId: 'zip-study',
      configs: [{ hash: 'h1', config }],
      hashes: ['other'],
    });

    // Still downloads an (empty) zip
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});

describe('downloadParticipantsAudioZip', () => {
  test('fetches audio for each answered trial and downloads a combined zip', async () => {
    const audioUrl = 'https://example.com/audio.webm';
    const storageEngine = makeStorageEngine({
      getAudioUrl: vi.fn(async () => audioUrl),
      getTranscriptUrl: vi.fn(async () => null),
    });

    const participants = [
      {
        participantId: 'p1',
        answers: {
          trial_0: {
            endTime: 1000, startTime: 0, componentName: 'trial', trialOrder: '0',
          },
        },
      },
    ];

    await downloadParticipantsAudioZip({ storageEngine, participants, studyId: 'my-study' });

    expect((storageEngine.getAudioUrl as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  test('skips trials where endTime is 0 (not yet completed)', async () => {
    const storageEngine = makeStorageEngine({
      getAudioUrl: vi.fn(async () => 'https://example.com/audio.webm'),
    });

    const participants = [
      {
        participantId: 'p1',
        answers: {
          trial_0: {
            endTime: 0, startTime: 0, componentName: 'trial', trialOrder: '0',
          },
        },
      },
    ];

    await downloadParticipantsAudioZip({ storageEngine, participants, studyId: 'my-study' });

    expect((storageEngine.getAudioUrl as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    // Still downloads an (empty) zip
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  test('uses the provided fileName as zip name prefix', async () => {
    const storageEngine = makeStorageEngine();

    await downloadParticipantsAudioZip({
      storageEngine, participants: [], studyId: 'study', fileName: 'custom-name',
    });

    expect(clickSpy).toHaveBeenCalledOnce();
  });
});
