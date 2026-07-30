import { expect, test } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  readParticipantRecording,
  readStoredValue,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('SMEQ replay restores the saved slider value without writing participant data', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Tests', 'SMEQ: Subjective Mental Effort Questionnaire');
  await nextClick(page);

  const participantTrack = page.getByTestId('smeq-slider-track');
  await expect(participantTrack).toBeVisible();
  await participantTrack.click({ position: { x: 11, y: 225 } });
  const replayPath = new URL(page.url()).pathname;
  await nextClick(page);
  await waitForStudyEndMessage(page);

  await expect.poll(async () => (
    await readParticipantRecording(page, 'library-smeq', '$smeq.components.smeq_1')
  )?.participantId ?? '', { timeout: 15000 }).not.toBe('');
  const recording = await readParticipantRecording(
    page,
    'library-smeq',
    '$smeq.components.smeq_1',
  );
  if (!recording) {
    throw new Error('No recorded SMEQ answer found');
  }

  const savedValue = Number(recording.answer.smeq);
  expect(Number.isFinite(savedValue)).toBe(true);
  const participantKey = `dev-library-smeq/participants/${recording.participantId}_participantData`;
  const participantBeforeReplay = await readStoredValue(page, participantKey);

  await page.goto(`${replayPath}?participantId=${recording.participantId}&revisitPageId=e2e-smeq-replay`);
  const replayTrack = page.getByTestId('smeq-slider-track');
  const replayThumb = page.getByTestId('smeq-slider-thumb');
  await expect(replayTrack).toHaveAttribute('aria-disabled', 'true');
  await expect(replayThumb).toBeVisible();

  const trackBounds = await replayTrack.boundingBox();
  const thumbBounds = await replayThumb.boundingBox();
  if (!trackBounds || !thumbBounds) {
    throw new Error('SMEQ replay slider has no bounds');
  }
  const displayedOffset = trackBounds.y + trackBounds.height
    - (thumbBounds.y + thumbBounds.height / 2);
  const expectedOffset = (savedValue / 150) * trackBounds.height;
  expect(Math.abs(displayedOffset - expectedOffset)).toBeLessThan(2);
  expect(await readStoredValue(page, participantKey)).toEqual(participantBeforeReplay);
});
