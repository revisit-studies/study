import {
  afterEach, expect, test, vi,
} from 'vitest';
import type { StorageEngine } from '../../storage/engines/types';
import { getScreenRecordingSegmentUrl } from '../recordingAssets';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('rebuilds an interrupted screen recording from persisted chunks in order', async () => {
  const getScreenRecording = vi.fn(async (identifier: string) => (
    identifier === 'segment' ? null : `https://assets.test/${identifier}`
  ));
  const storageEngine = { getScreenRecording } as unknown as StorageEngine;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.split('/').pop()!)));
  const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');

  await expect(getScreenRecordingSegmentUrl(
    storageEngine,
    'participant',
    'segment',
    ['segment__chunk_0', 'segment__chunk_1'],
  )).resolves.toBe('blob:recording');

  expect(createObjectUrl).toHaveBeenCalledOnce();
  const recordingBlob = createObjectUrl.mock.calls[0][0] as Blob;
  await expect(recordingBlob.text()).resolves.toBe('segment__chunk_0segment__chunk_1');
  expect(getScreenRecording.mock.calls.map(([identifier]) => identifier)).toEqual([
    'segment', 'segment__chunk_0', 'segment__chunk_1',
  ]);
});

test('reports a segment as incomplete when any persisted chunk is missing', async () => {
  const storageEngine = {
    getScreenRecording: vi.fn(async (identifier: string) => (
      identifier === 'segment' || identifier === 'segment__chunk_1' ? null : `https://assets.test/${identifier}`
    )),
  } as unknown as StorageEngine;
  await expect(getScreenRecordingSegmentUrl(
    storageEngine,
    'participant',
    'segment',
    ['segment__chunk_0', 'segment__chunk_1'],
  )).rejects.toThrow('one or more recording chunks are unavailable');
});
