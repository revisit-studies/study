import { expect, test } from '@playwright/test';
import {
  nextClick, openStudyFromLanding, readParticipantRecording, readStoredValue, resetClientStudyState, waitForStudyEndMessage,
} from './utils';

type StoredTrial = {
  assetIdentifier?: string;
  recordingSegments?: string[];
  recordingSegmentRanges?: Array<{ assetIdentifier: string; startTime: number; endTime: number }>;
};

test('screen-only replay settles provenance loading after changing duration during an earlier segment load', async ({ page }) => {
  await page.addInitScript(() => {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const context = canvas.getContext('2d')!;
        const paint = () => {
          context.fillStyle = `hsl(${(Date.now() / 20) % 360}, 60%, 70%)`;
          context.fillRect(0, 0, canvas.width, canvas.height);
        };
        paint();
        setInterval(paint, 100);
        const stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(10);
        stream.getVideoTracks().forEach((track) => {
          const getSettings = track.getSettings.bind(track);
          track.getSettings = () => ({ ...getSettings(), displaySurface: 'monitor' });
        });
        return stream;
      };
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function open(method, url, ...args) {
      (this as XMLHttpRequest & { isRecordingAsset?: boolean }).isRecordingAsset = String(url).startsWith('blob:');
      return originalOpen.call(this, method, url, ...args);
    };
    XMLHttpRequest.prototype.send = function send(...args) {
      const request = this as XMLHttpRequest & { isRecordingAsset?: boolean };
      if (request.isRecordingAsset) {
        const counter = window as Window & { __recordingAssetRequests?: number };
        counter.__recordingAssetRequests = (counter.__recordingAssetRequests ?? 0) + 1;
        setTimeout(() => originalSend.apply(this, args), 150);
      } else {
        originalSend.apply(this, args);
      }
    };
  });
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Entire Screen Recording');
  await nextClick(page);
  await page.getByRole('button', { name: 'Start Recording' }).click();
  const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
  await expect(continueButton).toBeEnabled({ timeout: 15000 });
  await continueButton.click();

  const taskPath = new URL(page.url()).pathname;
  const response = page.getByRole('textbox', { name: 'Answer:' });
  await expect(response).toBeVisible();
  await response.fill('4');
  await nextClick(page);
  await waitForStudyEndMessage(page);

  const studyId = 'demo-entire-screen-recording';
  const identifier = 'recorded_task_2';
  await expect.poll(async () => (await readParticipantRecording(page, studyId, identifier))?.participantId ?? '').not.toBe('');
  const recording = await readParticipantRecording(page, studyId, identifier);
  if (!recording) throw new Error('No completed screen-recording task was saved');

  const participantKey = `dev-${studyId}/participants/${recording.participantId}_participantData`;
  const screenRecordingPrefix = `dev-${studyId}/screenRecording/${recording.participantId}_`;
  const seededSegment = await page.evaluate(async ({ participantKey: key, screenRecordingPrefix: prefix, identifier: task }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('revisit');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('keyvaluepairs', 'readwrite');
    const store = transaction.objectStore('keyvaluepairs');
    const participant = await new Promise<{ answers: Record<string, StoredTrial> }>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as { answers: Record<string, StoredTrial> });
      request.onerror = () => reject(request.error);
    });
    const answer = participant.answers[task];
    if (!answer?.assetIdentifier) throw new Error('The task has no screen recording asset identifier');
    const recordingBlob = await new Promise<Blob>((resolve, reject) => {
      const request = store.get(`${prefix}${answer.assetIdentifier}`);
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result as Blob);
        } else {
          reject(new Error('Saved screen recording was not found'));
        }
      };
      request.onerror = () => reject(request.error);
    });
    const earlierSegment = `${answer.assetIdentifier}__earlier`;
    store.put(recordingBlob, `${prefix}${earlierSegment}`);
    answer.recordingSegments = Array.from(new Set([earlierSegment, ...(answer.recordingSegments ?? [])]));
    const segmentStartTime = answer.recordingSegmentRanges?.[0]?.startTime ?? Date.now() - 2000;
    answer.recordingSegmentRanges = [
      { assetIdentifier: earlierSegment, startTime: segmentStartTime, endTime: segmentStartTime + 1000 },
      ...(answer.recordingSegmentRanges ?? []),
    ];
    store.put(participant, key);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    return earlierSegment;
  }, { participantKey, screenRecordingPrefix, identifier });

  const replaySearch = new URLSearchParams({
    participantId: recording.participantId,
    analysisAnswerId: identifier,
    revisitPageId: 'e2e-screen-replay-loading',
    recordingSegment: seededSegment,
  });
  await page.goto(`${taskPath}?${replaySearch}`);
  const loadingOverlay = page.getByTestId('audio-provenance-loading-overlay');
  await expect(page.locator('#waveformDiv')).toBeAttached({ timeout: 15000 });
  await expect(loadingOverlay).toBeHidden({ timeout: 3000 });
  await expect.poll(() => page.evaluate(() => (window as Window & { __recordingAssetRequests?: number }).__recordingAssetRequests ?? 0)).toBeGreaterThanOrEqual(1);
  expect(await readStoredValue(page, `${screenRecordingPrefix}${seededSegment}`)).toBeTruthy();
});
