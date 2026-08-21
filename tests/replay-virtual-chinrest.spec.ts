/* eslint-disable no-await-in-loop */
import { expect, test } from '@playwright/test';
import {
  nextClick,
  readParticipantRecording,
  resetClientStudyState,
  seekReplay,
  waitForStudyEndMessage,
} from './utils';

test('virtual chinrest replays card adjustments and viewing-distance measurements', async ({ page }) => {
  await resetClientStudyState(page);
  await page.goto('/library-virtual-chinrest');
  await nextClick(page);

  const cardPath = new URL(page.url()).pathname;
  const cardSlider = page.getByRole('slider');
  await cardSlider.focus();
  await cardSlider.press('ArrowRight');
  const adjustedCardWidth = (await page.getByTestId('virtual-card').boundingBox())?.width;
  expect(adjustedCardWidth).toBeTruthy();
  await page.getByRole('button', { name: 'Confirm Size' }).click();
  await nextClick(page);

  const distancePath = new URL(page.url()).pathname;
  const replayBall = page.getByTestId('blindspot-ball');
  await expect(replayBall).toBeVisible();
  for (let measurement = 0; measurement < 5; measurement += 1) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Space');
    await expect.poll(async () => replayBall.evaluate((ball) => ball.style.left)).not.toBe('740px');
    await page.keyboard.press('Space');
    await expect(page.getByText(`Remaining measurements: ${4 - measurement}`)).toBeVisible();
  }
  await nextClick(page);
  await waitForStudyEndMessage(page);

  await expect.poll(async () => {
    const card = await readParticipantRecording(
      page,
      'library-virtual-chinrest',
      '$virtual-chinrest.components.card-size_1',
    );
    const distance = await readParticipantRecording(
      page,
      'library-virtual-chinrest',
      '$virtual-chinrest.components.blindspot-distance_2',
    );
    return Boolean(card && distance);
  }, { timeout: 15000 }).toBe(true);

  const cardRecording = await readParticipantRecording(
    page,
    'library-virtual-chinrest',
    '$virtual-chinrest.components.card-size_1',
  );
  const distanceRecording = await readParticipantRecording(
    page,
    'library-virtual-chinrest',
    '$virtual-chinrest.components.blindspot-distance_2',
  );
  if (!cardRecording || !distanceRecording) {
    throw new Error('No recorded virtual-chinrest answers found');
  }

  await page.goto(`${cardPath}?participantId=${cardRecording.participantId}&revisitPageId=e2e-card-replay`);
  await seekReplay(page, cardRecording.startTime, cardRecording.endTime, cardRecording.startTime);
  await expect.poll(async () => (await page.getByTestId('virtual-card').boundingBox())?.width).toBe(300);
  await seekReplay(page, cardRecording.startTime, cardRecording.endTime, cardRecording.endTime);
  await expect.poll(async () => (await page.getByTestId('virtual-card').boundingBox())?.width).toBeCloseTo(adjustedCardWidth!, 0);

  await page.goto(`${distancePath}?participantId=${distanceRecording.participantId}&revisitPageId=e2e-distance-replay`);
  await seekReplay(
    page,
    distanceRecording.startTime,
    distanceRecording.endTime,
    distanceRecording.startTime,
  );
  await expect(page.getByText('Remaining measurements: 5')).toBeVisible();
  await seekReplay(
    page,
    distanceRecording.startTime,
    distanceRecording.endTime,
    distanceRecording.endTime,
  );
  await expect(page.getByText('Remaining measurements: 0')).toBeVisible();
  await expect(page.getByTestId('blindspot-ball')).not.toHaveCSS('left', '740px');
});
