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
    if (audioUrl) {
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();
      const audioFileName = `${namePrefix}_${participantId}_${identifier}.webm`;
      audioZip.file(audioFileName, audioBlob);
    }

    const transcriptUrl = await storageEngine.getTranscriptUrl(identifier, participantId);
    if (transcriptUrl) {
      const transcriptResponse = await fetch(transcriptUrl);
      const transcriptBlob = await transcriptResponse.blob();
      const transcriptFileName = `${namePrefix}_${participantId}_${identifier}_transcript.txt`;
      audioZip.file(transcriptFileName, transcriptBlob);
    }

    if (!zip) {
      const zipBlob = await audioZip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      Object.assign(document.createElement('a'), {
        href: url,
        download: `${namePrefix}_${participantId}_${identifier}_audio.zip`,
      }).click();
      URL.revokeObjectURL(url);
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

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  Object.assign(document.createElement('a'), {
    href: url,
    download: `${namePrefix}_audio.zip`,
  }).click();
  URL.revokeObjectURL(url);
}
