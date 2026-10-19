/* eslint-disable no-await-in-loop */
import { expect, Page, test } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  readStoredValue,
  resetClientStudyState,
} from './utils';

type RecordedAnswer = { answer: Record<string, unknown>; endTime: number };

async function readCompletedAnswers(page: Page) {
  const studyId = 'dev-incentives-corr';
  const participantId = await readStoredValue<string>(page, `${studyId}/currentParticipantId`);
  const participant = await readStoredValue<{ answers: Record<string, RecordedAnswer> }>(
    page,
    `${studyId}/participants/${participantId}_participantData`,
  );
  return Object.values(participant?.answers ?? {}).filter(({ endTime }) => endTime > 0);
}

test('correlation trials accept intentional choices and persist matching response IDs', async ({ page }) => {
  test.setTimeout(120000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Factor-demos', 'Correlation Judgements using Visualization');
  await nextClick(page);
  await page.getByRole('radio', { name: 'Yes', exact: true }).check();
  await nextClick(page);
  await nextClick(page);

  const frame = page.frameLocator('#root iframe');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  const expectedPractice: Record<string, unknown>[] = [];

  for (let trialIndex = 0; trialIndex < 9; trialIndex += 1) {
    await expect(frame.locator('#stimuli-left')).toHaveAttribute('src', /training\/.*\.jpg$/);
    const leftSource = await frame.locator('#stimuli-left').getAttribute('src');
    const rightSource = await frame.locator('#stimuli-right').getAttribute('src');
    const corrLeft = Number(leftSource?.match(/-r1-([\d.]+)-/)?.[1]);
    const corrRight = Number(rightSource?.match(/-r2-([\d.]+)-/)?.[1]);
    expect(Number.isFinite(corrLeft) && Number.isFinite(corrRight)).toBe(true);
    const correct = corrLeft > corrRight ? 'left' : 'right';
    const isCorrect = trialIndex !== 1;
    const selected = isCorrect ? correct : (correct === 'left' ? 'right' : 'left');

    if (trialIndex === 0) {
      await frame.locator('.questionPrompt').click();
      for (const key of ['Tab', 'a', 'ArrowUp', 'ArrowDown', 'Shift+ArrowLeft']) {
        await frame.getByRole('button', { name: 'A', exact: true }).press(key);
      }
      await frame.locator('body').dispatchEvent('keydown', { key: 'ArrowRight', repeat: true });
      await next.click();
      await expect(page.getByText('Please finish the embedded activity to continue.', { exact: true })).toBeVisible();
      await expect(frame.getByRole('status')).toBeEmpty();
      await frame.getByRole('button', { name: selected === 'left' ? 'A' : 'B', exact: true }).click();
    } else {
      await frame.getByRole('button', { name: 'A', exact: true }).press(selected === 'left' ? 'ArrowLeft' : 'ArrowRight');
    }
    await expect(frame.getByRole('status')).toHaveText(`${isCorrect ? 'Correct' : 'Incorrect'} — A is ${corrLeft}, B is ${corrRight}`);
    await expect(next).toBeEnabled();
    await frame.locator(`#stimuli-${selected === 'left' ? 'right' : 'left'}`).click();
    await frame.locator('body').dispatchEvent('keydown', { key: selected === 'left' ? 'ArrowRight' : 'ArrowLeft' });
    expectedPractice.push({
      training: isCorrect, selected, corrLeft, corrRight,
    });
    const previousFrame = await page.locator('#root iframe').elementHandle();
    await nextClick(page);
    await previousFrame?.waitForElementState('hidden');
  }

  await expect.poll(async () => (await readCompletedAnswers(page))
    .filter(({ answer }) => typeof answer.training === 'boolean')
    .map(({ answer }) => answer)).toEqual(expectedPractice.map((answer) => expect.objectContaining(answer)));
  await nextClick(page);

  await expect(frame.locator('#stimuli-left')).toHaveAttribute('src', /stimuli\/.*\.jpg$/);
  await frame.locator('.questionPrompt').click();
  for (const key of ['Tab', 'x', 'ArrowUp', 'ArrowDown', 'Control+ArrowRight']) {
    await frame.getByRole('button', { name: 'A', exact: true }).press(key);
  }
  await next.click();
  await expect(page.getByText('Please finish the embedded activity to continue.', { exact: true })).toBeVisible();
  const leftSource = await frame.locator('#stimuli-left').getAttribute('src');
  const selected = leftSource?.includes('-r2-') ? 'right' : 'left';
  await frame.getByRole('button', { name: 'A', exact: true }).press(selected === 'left' ? 'ArrowLeft' : 'ArrowRight');
  await expect(next).toBeEnabled();
  await frame.locator(`#stimuli-${selected === 'left' ? 'right' : 'left'}`).click();
  const previousFrame = await page.locator('#root iframe').elementHandle();
  await nextClick(page);
  await previousFrame?.waitForElementState('hidden');
  await expect(frame.locator('#stimuli-left')).toHaveAttribute('src', /stimuli\/.*\.jpg$/);
  await expect.poll(async () => (await readCompletedAnswers(page))
    .filter(({ answer }) => typeof answer.test === 'boolean')
    .map(({ answer }) => answer)).toEqual([expect.objectContaining({ test: false, selected })]);
  expect(pageErrors).toEqual([]);
});
