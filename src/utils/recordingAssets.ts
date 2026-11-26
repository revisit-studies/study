import type { StorageEngine } from '../storage/engines/types';

/** Load a full recording when available, or rebuild one from its persisted recorder chunks. */
export async function getScreenRecordingSegment(
  storageEngine: StorageEngine,
  participantId: string,
  assetIdentifier: string,
  chunkIdentifiers: string[] = [],
): Promise<{ url: string | null; owned: boolean }> {
  const completeRecording = await storageEngine.getScreenRecording(assetIdentifier, participantId).catch(() => null);
  if (completeRecording || chunkIdentifiers.length === 0) {
    return { url: completeRecording, owned: !!completeRecording?.startsWith('blob:') };
  }

  const chunkUrls = await Promise.all(chunkIdentifiers.map((identifier) => (
    storageEngine.getScreenRecording(identifier, participantId).catch(() => null)
  )));
  const availableUrls = chunkUrls.filter((url): url is string => !!url);
  if (availableUrls.length !== chunkIdentifiers.length) {
    availableUrls.filter((url) => url.startsWith('blob:')).forEach((url) => URL.revokeObjectURL(url));
    throw new Error('Recording segment could not be reconstructed because one or more recording chunks are unavailable.');
  }

  try {
    const blobs = await Promise.all(availableUrls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to load recording chunk: ${response.status}`);
      return response.blob();
    }));
    const chunkData = await Promise.all(blobs.map((blob) => blob.arrayBuffer()));
    return {
      url: URL.createObjectURL(new Blob(chunkData, { type: blobs.find((blob) => blob.type)?.type ?? 'video/webm' })),
      owned: true,
    };
  } finally {
    availableUrls.forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }
}

export async function getScreenRecordingSegmentUrl(
  storageEngine: StorageEngine,
  participantId: string,
  assetIdentifier: string,
  chunkIdentifiers: string[] = [],
) {
  return (await getScreenRecordingSegment(storageEngine, participantId, assetIdentifier, chunkIdentifiers)).url;
}
