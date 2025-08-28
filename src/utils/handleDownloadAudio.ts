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

export async function downloadParticipantsAudio({
  storageEngine,
  participantId,
  identifier,
  zip,
  namePrefix,
}: {
  storageEngine: StorageEngine;
  participantId: string;
  identifier: string;
  zip: JSZip;
  namePrefix: string;
}) {
  try {
    const audioUrl = await storageEngine.getAudioUrl(identifier, participantId);
    if (audioUrl) {
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();
      const audioFileName = `${namePrefix}_${participantId}_${identifier}.webm`;
      zip.file(audioFileName, audioBlob);
    }

    const transcriptUrl = await storageEngine.getTranscriptUrl(identifier, participantId);
    if (transcriptUrl) {
      const transcriptResponse = await fetch(transcriptUrl);
      const transcriptBlob = await transcriptResponse.blob();
      const transcriptFileName = `${namePrefix}_${participantId}_${identifier}_transcript.txt`;
      zip.file(transcriptFileName, transcriptBlob);
    }
  } catch (error) {
    console.warn(`Failed to fetch files for ${identifier}:`, error);
  }
}
