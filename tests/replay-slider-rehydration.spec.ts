/* eslint-disable no-await-in-loop */
import { expect, test } from '@playwright/test';
import {
  nextClick,
  readParticipantRecording,
  readStoredValue,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('SMEQ replay restores the saved slider value without writing participant data', async ({ page }) => {
  await resetClientStudyState(page);
  await page.goto('/library-smeq');
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

test('NASA-TLX replay keeps the restored slider thumb visible', async ({ page }) => {
  await resetClientStudyState(page);
  await page.goto('/library-nasa-tlx');
  await nextClick(page);

  const sourceOptions = page.getByRole('radio');
  await expect(sourceOptions).toHaveCount(30);
  const sourceOptionCount = await sourceOptions.count();
  for (let index = 0; index < sourceOptionCount; index += 2) {
    await sourceOptions.nth(index).check();
  }
  await nextClick(page);

  const participantSliders = page.getByRole('slider');
  await expect(participantSliders).toHaveCount(6);
  await participantSliders.first().focus();
  await participantSliders.first().press('ArrowRight');
  const replayPath = new URL(page.url()).pathname;
  await nextClick(page);

  await expect.poll(async () => (
    await readParticipantRecording(
      page,
      'library-nasa-tlx',
      '$nasa-tlx.components.nasa-tlx_2',
    )
  )?.participantId ?? '', { timeout: 15000 }).not.toBe('');
  const recording = await readParticipantRecording(
    page,
    'library-nasa-tlx',
    '$nasa-tlx.components.nasa-tlx_2',
  );
  if (!recording) {
    throw new Error('No recorded NASA-TLX answer found');
  }
  const savedValue = String(recording.answer['mental-demand']);

  await page.goto(`${replayPath}?participantId=${recording.participantId}&revisitPageId=e2e-nasa-tlx-replay`);
  const replayThumb = page.getByRole('slider').first();
  await expect(replayThumb).toBeVisible();
  await expect(replayThumb).toHaveAttribute('aria-valuenow', savedValue);
});
