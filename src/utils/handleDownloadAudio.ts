import JSZip from 'jszip';
import { StorageEngine } from '../storage/engines/types';

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

export async function handleTaskScreenRecording({
  storageEngine,
  participantId,
  identifier,
  screenRecordingUrl,
}: {
  storageEngine: StorageEngine;
  participantId: string;
  identifier: string;
  screenRecordingUrl?: string | null;
}) {
  const finalScreenRecordingUrl = screenRecordingUrl || await storageEngine.getScreenRecording(identifier, participantId);

  if (finalScreenRecordingUrl) {
    const blob = await (await fetch(finalScreenRecordingUrl)).blob();
    const url = URL.createObjectURL(blob);

    Object.assign(document.createElement('a'), {
      href: url,
      download: `${participantId}_${identifier}_screenRecording.webm`,
    }).click();

    URL.revokeObjectURL(url);
  }
}

async function loadAssetToZip(zip: JSZip, fileName: string, assetUrl: string | null) {
  if (assetUrl) {
    const asset = await fetch(assetUrl);
    const audioBlob = await asset.blob();
    zip.file(fileName, audioBlob);
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

export async function downloadParticipantsAudioZip({
  storageEngine,
  participants,
  studyId,
  fileName,
}: {
  storageEngine: StorageEngine;
  participants: Array<{ participantId: string; answers: Record<string, { endTime: number; startTime: number; componentName: string; trialOrder: string }> }>;
  studyId: string;
  fileName?: string | null;
}) {
  const namePrefix = fileName || studyId;
  const zip = new JSZip();

  const audioPromises = participants.flatMap((participant) => {
    const entries = Object.values(participant.answers)
      .filter((ans) => ans.endTime > 0)
      .sort((a, b) => a.startTime - b.startTime);

    return entries.map(async (ans) => {
      const identifier = `${ans.componentName}_${ans.trialOrder}`;

      await downloadParticipantsAudio({
        storageEngine,
        participantId: participant.participantId,
        identifier,
        namePrefix,
        zip,
      });
    });
  });

  await Promise.all(audioPromises);

  await downloadZip(zip, `${namePrefix}_audio.zip`);
}

async function downloadParticipantsScreenRecording({
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
  const screenRecordingZip = zip || new JSZip();

  try {
    const screenRecordingUrl = await storageEngine.getScreenRecording(identifier, participantId);
    await loadAssetToZip(screenRecordingZip, `${namePrefix}_${participantId}_${identifier}.webm`, screenRecordingUrl);

    if (!zip) {
      downloadZip(screenRecordingZip, `${namePrefix}_${participantId}_${identifier}_screenRecording.zip`);
    }
  } catch (error) {
    console.warn(`Failed to fetch files for ${identifier}:`, error);
  }
}

export async function downloadParticipantsScreenRecordingZip({
  storageEngine,
  participants,
  studyId,
  fileName,
}: {
  storageEngine: StorageEngine;
  participants: Array<{ participantId: string; answers: Record<string, { endTime: number; startTime: number; componentName: string; trialOrder: string }> }>;
  studyId: string;
  fileName?: string | null;
}) {
  const namePrefix = fileName || studyId;
  const zip = new JSZip();

  const screenRecordingPromises = participants.flatMap((participant) => {
    const entries = Object.values(participant.answers)
      .filter((ans) => ans.endTime > 0)
      .sort((a, b) => a.startTime - b.startTime);

    return entries.map(async (ans) => {
      const identifier = `${ans.componentName}_${ans.trialOrder}`;

      await downloadParticipantsScreenRecording({
        storageEngine,
        participantId: participant.participantId,
        identifier,
        namePrefix,
        zip,
      });
    });
  });

  await Promise.all(screenRecordingPromises);

  await downloadZip(zip, `${namePrefix}_screenRecording.zip`);
}
