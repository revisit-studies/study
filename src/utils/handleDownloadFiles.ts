import JSZip from 'jszip';
import { GLOBAL_STORE_TASK } from '../store/globalStoreProvenance';
import { getGlobalStoreHistory } from '../store/globalStoreHistory';
import { StorageEngine } from '../storage/engines/types';
import { StudyConfig } from '../parser/types';
import { getLegacyStoredAnswerProvenance } from '../store/provenance';
import type { StoredAnswer } from '../store/types';
import { getScreenRecordingSegment } from './recordingAssets';

type DownloadAnswer = Pick<StoredAnswer, 'endTime' | 'startTime' | 'componentName' | 'trialOrder'>
  & Partial<Pick<StoredAnswer, 'identifier' | 'assetIdentifier' | 'recordingSegments' | 'recordingChunkKeys'>>;

export async function handleTaskAudio({
  storageEngine,
  participantId,
  identifier,
  audioUrl,
}: {
  storageEngine: StorageEngine;
  participantId: string;
  identifier: string;
  audioUrl?: string | null;
}) {
  const finalAudioUrl = audioUrl || await storageEngine.getAudioUrl(identifier, participantId);

  if (finalAudioUrl) {
    const blob = await (await fetch(finalAudioUrl)).blob();
    const url = URL.createObjectURL(blob);

    Object.assign(document.createElement('a'), {
      href: url,
      download: `${participantId}_${identifier}_audio.webm`,
    }).click();

    URL.revokeObjectURL(url);
  }

  const transcriptUrl = await storageEngine.getTranscriptUrl(identifier, participantId);

  if (transcriptUrl) {
    const transcriptBlob = await (await fetch(transcriptUrl)).blob();
    const transcriptBlobUrl = URL.createObjectURL(transcriptBlob);

    Object.assign(document.createElement('a'), {
      href: transcriptBlobUrl,
      download: `${participantId}_${identifier}_transcript.txt`,
    }).click();

    URL.revokeObjectURL(transcriptBlobUrl);
  }
}

type RecordingType = 'screenRecording' | 'webcamRecording';

function recordingArchiveName(includeScreen: boolean, includeWebcam: boolean) {
  if (includeScreen && !includeWebcam) return 'screenRecording';
  if (includeWebcam && !includeScreen) return 'webcamRecording';
  return 'recordings';
}

async function getTaskRecordingUrl({
  storageEngine,
  participantId,
  identifier,
  recordingType,
  recordingUrl,
  chunkIdentifiers,
}: {
  storageEngine: StorageEngine;
  participantId: string;
  identifier: string;
  recordingType: RecordingType;
  recordingUrl?: string | null;
  chunkIdentifiers?: string[];
}) {
  if (recordingUrl) {
    return { url: recordingUrl, owned: false };
  }
  if (recordingType === 'screenRecording') {
    return getScreenRecordingSegment(storageEngine, participantId, identifier, chunkIdentifiers);
  }
  const webcamRecording = await storageEngine.getWebcamRecording(identifier, participantId);
  return { url: webcamRecording, owned: !!webcamRecording?.startsWith('blob:') };
}

export async function handleTaskRecordings({
  storageEngine,
  participantId,
  identifier,
  includeScreen,
  includeWebcam,
  screenRecordingUrl,
  webcamRecordingUrl,
  recordingChunkIdentifiers,
}: {
  storageEngine: StorageEngine;
  participantId: string;
  identifier: string;
  includeScreen: boolean;
  includeWebcam: boolean;
  screenRecordingUrl?: string | null;
  webcamRecordingUrl?: string | null;
  recordingChunkIdentifiers?: string[];
}) {
  const recordings: Array<{ type: RecordingType; url?: string | null }> = [
    ...(includeScreen ? [{ type: 'screenRecording' as const, url: screenRecordingUrl }] : []),
    ...(includeWebcam ? [{ type: 'webcamRecording' as const, url: webcamRecordingUrl }] : []),
  ];

  await Promise.all(recordings.map(async ({ type, url: providedUrl }) => {
    try {
      const recording = await getTaskRecordingUrl({
        storageEngine,
        participantId,
        identifier,
        recordingType: type,
        recordingUrl: providedUrl,
        chunkIdentifiers: type === 'screenRecording' ? recordingChunkIdentifiers : undefined,
      });
      if (!recording.url) return;

      try {
        const blob = await (await fetch(recording.url)).blob();
        const objectUrl = URL.createObjectURL(blob);
        try {
          Object.assign(document.createElement('a'), {
            href: objectUrl,
            download: `${participantId}_${identifier}_${type}.webm`,
          }).click();
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } finally {
        if (recording.owned) URL.revokeObjectURL(recording.url);
      }
    } catch (error) {
      console.warn(`Failed to fetch ${type} for ${identifier}:`, error);
    }
  }));
}

async function loadAssetToZip(zip: JSZip, fileName: string, assetUrl: string | null, owned = false) {
  if (assetUrl) {
    try {
      const asset = await fetch(assetUrl);
      const audioBlob = await asset.blob();
      zip.file(fileName, audioBlob);
    } finally {
      if (owned) URL.revokeObjectURL(assetUrl);
    }
  }
}

async function downloadZip(zip: JSZip, fileName: string) {
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  Object.assign(document.createElement('a'), {
    href: url,
    download: fileName,
  }).click();
  URL.revokeObjectURL(url);
}

async function downloadParticipantsProvenance({
  storageEngine,
  participantId,
  identifier,
  namePrefix,
  zip,
  answer,
}: {
  storageEngine: StorageEngine;
  participantId: string;
  identifier: string;
  namePrefix: string;
  zip?: JSZip;
  answer?: StoredAnswer;
}) {
  const provenanceZip = zip || new JSZip();

  try {
    const legacyProvenance = answer ? getLegacyStoredAnswerProvenance(answer) : null;
    const provenance = legacyProvenance || await storageEngine.getProvenance(identifier, participantId);

    if (provenance) {
      provenanceZip.file(
        `${namePrefix}_${participantId}_${identifier}_provenance.json`,
        JSON.stringify(provenance, null, 2),
      );
    }

    if (!zip) {
      downloadZip(provenanceZip, `${namePrefix}_${participantId}_${identifier}_provenance.zip`);
    }
  } catch (error) {
    console.warn(`Failed to fetch provenance for ${identifier}:`, error);
  }
}

async function downloadParticipantsAudio({
  storageEngine,
  participantId,
  identifier,
  namePrefix,
  zip,
}: {
  storageEngine: StorageEngine;
  participantId: string;
  identifier: string;
  namePrefix: string;
  zip?: JSZip;
}) {
  const audioZip = zip || new JSZip();

  try {
    const audioUrl = await storageEngine.getAudioUrl(identifier, participantId);
    await loadAssetToZip(audioZip, `${namePrefix}_${participantId}_${identifier}.webm`, audioUrl);

    const transcriptUrl = await storageEngine.getTranscriptUrl(identifier, participantId);
    await loadAssetToZip(audioZip, `${namePrefix}_${participantId}_${identifier}_transcript.txt`, transcriptUrl);

    if (!zip) {
      downloadZip(audioZip, `${namePrefix}_${participantId}_${identifier}_audio.zip`);
    }
  } catch (error) {
    console.warn(`Failed to fetch files for ${identifier}:`, error);
  }
}

async function getParticipantRecordingEntries(storageEngine: StorageEngine, participant: { participantId: string; answers: Record<string, DownloadAnswer> }) {
  const entries = Object.entries(participant.answers).map(([storedIdentifier, answer]) => ({ storedIdentifier, answer }));
  if (entries.some(({ answer }) => answer.assetIdentifier || answer.recordingSegments?.length)) {
    const graph = (await storageEngine.getProvenance(GLOBAL_STORE_TASK, participant.participantId))?.globalStore;
    if (graph) {
      getGlobalStoreHistory(graph).forEach(({ submission }) => {
        entries.push({ storedIdentifier: submission.answer.identifier, answer: submission.answer });
      });
    }
  }
  const byAsset = new Map<string, { storedIdentifier: string; answer: DownloadAnswer; assetIdentifier: string }>();
  entries.forEach(({ storedIdentifier, answer }) => {
    const segments = Array.from(new Set([
      ...(answer.recordingSegments ?? []),
      ...(answer.assetIdentifier ? [answer.assetIdentifier] : []),
    ]));
    if (answer.endTime <= 0 && segments.length === 0) return;
    (segments.length > 0 ? segments : [answer.identifier || storedIdentifier]).forEach((assetIdentifier) => {
      if (!assetIdentifier) return;
      const existing = byAsset.get(assetIdentifier);
      byAsset.set(assetIdentifier, {
        storedIdentifier,
        answer: existing ? {
          ...answer,
          ...existing.answer,
          recordingChunkKeys: {
            ...answer.recordingChunkKeys,
            ...existing.answer.recordingChunkKeys,
            [assetIdentifier]: Array.from(new Set([
              ...(answer.recordingChunkKeys?.[assetIdentifier] ?? []),
              ...(existing.answer.recordingChunkKeys?.[assetIdentifier] ?? []),
            ])),
          },
        } : answer,
        assetIdentifier,
      });
    });
  });
  return [...byAsset.values()].sort((a, b) => a.answer.startTime - b.answer.startTime);
}

export async function downloadParticipantsAudioZip({
  storageEngine,
  participants,
  studyId,
  fileName,
}: {
  storageEngine: StorageEngine;
  participants: Array<{ participantId: string; answers: Record<string, DownloadAnswer> }>;
  studyId: string;
  fileName?: string | null;
}) {
  const namePrefix = fileName || studyId;
  const zip = new JSZip();

  const audioPromises = participants.map(async (participant) => {
    const entries = await getParticipantRecordingEntries(storageEngine, participant);
    return Promise.all(entries.map(async ({ assetIdentifier: identifier }) => {
      await downloadParticipantsAudio({
        storageEngine, participantId: participant.participantId, identifier, namePrefix, zip,
      });
    }));
  });

  await Promise.all(audioPromises);

  await downloadZip(zip, `${namePrefix}_audio.zip`);
}

async function downloadParticipantsRecordings({
  storageEngine,
  participantId,
  identifier,
  namePrefix,
  includeScreen,
  includeWebcam,
  chunkIdentifiers,
  zip,
}: {
  storageEngine: StorageEngine;
  participantId: string;
  identifier: string;
  namePrefix: string;
  includeScreen: boolean;
  includeWebcam: boolean;
  chunkIdentifiers?: string[];
  zip?: JSZip;
}) {
  const recordingsZip = zip || new JSZip();
  const recordingTypes: RecordingType[] = [
    ...(includeScreen ? ['screenRecording' as const] : []),
    ...(includeWebcam ? ['webcamRecording' as const] : []),
  ];

  await Promise.all(recordingTypes.map(async (recordingType) => {
    try {
      const recording = await getTaskRecordingUrl({
        storageEngine,
        participantId,
        identifier,
        recordingType,
        chunkIdentifiers: recordingType === 'screenRecording' ? chunkIdentifiers : undefined,
      });
      const memberName = includeScreen && !includeWebcam
        ? `${namePrefix}_${participantId}_${identifier}.webm`
        : `${namePrefix}_${participantId}_${identifier}_${recordingType}.webm`;
      await loadAssetToZip(recordingsZip, memberName, recording.url, recording.owned);
    } catch (error) {
      console.warn(`Failed to fetch ${recordingType} for ${identifier}:`, error);
    }
  }));

  if (!zip) {
    downloadZip(recordingsZip, `${namePrefix}_${participantId}_${identifier}_${recordingArchiveName(includeScreen, includeWebcam)}.zip`);
  }
}

export async function downloadParticipantsRecordingsZip({
  storageEngine,
  participants,
  studyId,
  includeScreen,
  includeWebcam,
  fileName,
}: {
  storageEngine: StorageEngine;
  participants: Array<{ participantId: string; answers: Record<string, DownloadAnswer> }>;
  studyId: string;
  includeScreen: boolean;
  includeWebcam: boolean;
  fileName?: string | null;
}) {
  const namePrefix = fileName || studyId;
  const zip = new JSZip();

  const recordingPromises = participants.map(async (participant) => {
    const entries = await getParticipantRecordingEntries(storageEngine, participant);
    return Promise.all(entries.map(async ({ answer, assetIdentifier: identifier }) => {
      await downloadParticipantsRecordings({
        storageEngine,
        participantId: participant.participantId,
        identifier,
        namePrefix,
        includeScreen,
        includeWebcam,
        chunkIdentifiers: answer.recordingChunkKeys?.[identifier],
        zip,
      });
    }));
  });

  await Promise.all(recordingPromises);

  await downloadZip(zip, `${namePrefix}_${recordingArchiveName(includeScreen, includeWebcam)}.zip`);
}

export async function downloadParticipantsProvenanceZip({
  storageEngine,
  participants,
  studyId,
  fileName,
}: {
  storageEngine: StorageEngine;
  participants: Array<{
    participantId: string;
    answers: Record<string, StoredAnswer>;
  }>;
  studyId: string;
  fileName?: string | null;
}) {
  const namePrefix = fileName || studyId;
  const zip = new JSZip();

  const provenancePromises = participants.map(async (participant) => {
    const globalProvenance = await storageEngine.getProvenance(GLOBAL_STORE_TASK, participant.participantId);
    const graph = globalProvenance?.globalStore;
    const history = graph ? getGlobalStoreHistory(graph) : [];
    if (graph) zip.file(`${namePrefix}_${participant.participantId}_${GLOBAL_STORE_TASK}_provenance.json`, JSON.stringify(globalProvenance, null, 2));
    const entries = Object.entries(participant.answers)
      .filter(([, ans]) => ans.endTime > 0)
      .sort(([, a], [, b]) => a.startTime - b.startTime);

    const allAnswers = new Map(entries.map(([identifier, answer]) => [identifier, answer]));
    history.forEach(({ submission }) => { allAnswers.set(submission.answer.identifier, submission.answer); });
    return Promise.all([...allAnswers].map(async ([identifier, ans]) => {
      await downloadParticipantsProvenance({
        storageEngine,
        participantId: participant.participantId,
        identifier: ans.identifier || identifier,
        namePrefix,
        zip,
        answer: ans,
      });
    }));
  });

  await Promise.all(provenancePromises);

  await downloadZip(zip, `${namePrefix}_provenance.zip`);
}

export async function downloadConfigFile({
  studyId,
  hash,
  config,
}: {
  studyId: string;
  hash: string;
  config: StudyConfig;
}) {
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  Object.assign(document.createElement('a'), {
    href: url,
    download: `${studyId}_${hash}_config.json`,
  }).click();

  URL.revokeObjectURL(url);
}

export async function downloadConfigFilesZip({
  studyId,
  configs,
  hashes,
}: {
  studyId: string;
  configs: Array<{ hash: string; config: StudyConfig }>;
  hashes: string[];
}) {
  const zip = new JSZip();

  hashes.forEach((hash) => {
    const configFile = configs.find((config) => config.hash === hash);
    if (!configFile) {
      return;
    }

    zip.file(`${studyId}_${hash}_config.json`, JSON.stringify(configFile.config, null, 2));
  });

  await downloadZip(zip, `${studyId}_config.zip`);
}
