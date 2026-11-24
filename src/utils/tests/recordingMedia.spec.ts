import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { createRecordingMediaRecorder } from '../recordingMedia';

describe('createRecordingMediaRecorder', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('uses a common WebM codec for screen recordings with audio', () => {
    const isTypeSupported = vi.fn(() => true);
    class MockMediaRecorder {
      static isTypeSupported = isTypeSupported;

      constructor(public stream: MediaStream, public options?: MediaRecorderOptions) {}
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    const stream = {
      getVideoTracks: () => [{}],
      getAudioTracks: () => [{}],
    } as unknown as MediaStream;

    const recorder = createRecordingMediaRecorder(stream);

    expect(isTypeSupported).toHaveBeenCalledWith('video/webm;codecs=vp8,opus');
    expect(recorder).toMatchObject({ stream, options: { mimeType: 'video/webm;codecs=vp8,opus' } });
  });

  test('uses Opus WebM for audio-only recordings', () => {
    const isTypeSupported = vi.fn(() => true);
    class MockMediaRecorder {
      static isTypeSupported = isTypeSupported;

      constructor(public stream: MediaStream, public options?: MediaRecorderOptions) {}
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    const stream = {
      getVideoTracks: () => [],
      getAudioTracks: () => [{}],
    } as unknown as MediaStream;

    expect(createRecordingMediaRecorder(stream)).toMatchObject({
      stream,
      options: { mimeType: 'audio/webm;codecs=opus' },
    });
  });

  test('falls back to the browser default when the shared codec is unsupported', () => {
    const isTypeSupported = vi.fn(() => false);
    class MockMediaRecorder {
      static isTypeSupported = isTypeSupported;

      constructor(public stream: MediaStream, public options?: MediaRecorderOptions) {}
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    const stream = {
      getVideoTracks: () => [{}],
      getAudioTracks: () => [],
    } as unknown as MediaStream;

    expect(createRecordingMediaRecorder(stream)).toMatchObject({ stream, options: undefined });
  });
});
