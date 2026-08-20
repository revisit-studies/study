/* eslint-disable no-await-in-loop */
import {
  expect, test, type FrameLocator, type Page,
} from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  readStoredValue,
  resetClientStudyState,
  seekReplay,
} from './utils';

const demos = [
  {
    title: 'HTML with Trrack library',
    studyId: 'demo-html-trrack',
  },
  {
    title: 'Svelte with Trrack library',
    studyId: 'demo-svelte-trrack',
  },
] as const;

type RecordedReplay = {
  participantId: string;
  startTime: number;
  endTime: number;
  traversalTimes: number[];
};

async function expectDotCount(frame: FrameLocator, count: number) {
  await expect(frame.locator('circle')).toHaveCount(count);
}

async function readRecordedReplay(page: Page, studyId: string): Promise<RecordedReplay | null> {
  const assignments = await readStoredValue<Record<string, unknown>>(page, `dev-${studyId}/sequenceAssignment`);
  const participantId = Object.keys(assignments ?? {})[0];
  if (!participantId) {
    return null;
  }

  const participant = await readStoredValue<{ answers?: Record<string, { startTime?: number; endTime?: number }> }>(
    page,
    `dev-${studyId}/participants/${participantId}_participantData`,
  );
  const provenance = await readStoredValue<{ stimulus?: { traversalEvents?: Array<{ createdOn?: number }> } }>(
    page,
    `dev-${studyId}/provenance/${participantId}_countDots_1`,
  );
  const answer = participant?.answers?.countDots_1;
  const traversalTimes = provenance?.stimulus?.traversalEvents
    ?.map((event) => event.createdOn)
    .filter((createdOn): createdOn is number => typeof createdOn === 'number') ?? [];

  if (
    typeof answer?.startTime !== 'number'
    || typeof answer.endTime !== 'number'
    || answer.startTime <= 0
    || answer.endTime < answer.startTime
  ) {
    return null;
  }

  return {
    participantId,
    startTime: answer.startTime,
    endTime: answer.endTime,
    traversalTimes,
  };
}

for (const demo of demos) {
  test(`${demo.title} initializes its answer and enforces dot limits`, async ({ page }) => {
    await resetClientStudyState(page);
    await openStudyFromLanding(page, 'Demo Studies', demo.title);
    await nextClick(page);

    const frame = page.frameLocator('#root iframe');
    const addButton = frame.getByRole('button', { name: 'Add' });
    const removeButton = frame.getByRole('button', { name: 'Remove' });

    await expectDotCount(frame, 1);
    await expect(page.getByRole('listitem').filter({ hasText: '1' })).toHaveCount(1);

    for (let count = 1; count < 20; count += 1) {
      await addButton.click();
    }

    await expectDotCount(frame, 20);
    await expect(addButton).toBeDisabled();
    await addButton.locator('..').hover();
    await expect(frame.getByRole('tooltip')).toBeVisible();
    await expect(frame.getByRole('tooltip')).toHaveText('Maximum of 20 dots reached.');

    await removeButton.click();
    await expect(addButton).toBeEnabled();
    await addButton.click();

    for (let count = 20; count > 0; count -= 1) {
      await removeButton.click();
    }

    await expectDotCount(frame, 0);
    await expect(removeButton).toBeDisabled();
    await removeButton.locator('..').hover();
    await expect(frame.getByRole('tooltip')).toBeVisible();
    await expect(frame.getByRole('tooltip')).toHaveText('Minimum of 0 dots reached.');

    await frame.getByRole('button', { name: 'Undo' }).click();
    await expectDotCount(frame, 1);
    await expect(removeButton).toBeEnabled();
    await frame.getByRole('button', { name: 'Redo' }).click();
    await expectDotCount(frame, 0);
  });

  test(`${demo.title} replays Undo and Redo in recorded order`, async ({ page }) => {
    await resetClientStudyState(page);
    await openStudyFromLanding(page, 'Demo Studies', demo.title);
    await nextClick(page);

    const participantFrame = page.frameLocator('#root iframe');
    const addButton = participantFrame.getByRole('button', { name: 'Add' });
    const replayPath = new URL(page.url()).pathname;

    await expectDotCount(participantFrame, 1);
    await page.waitForTimeout(150);
    await addButton.click();
    await expectDotCount(participantFrame, 2);
    await page.waitForTimeout(150);
    await addButton.click();
    await expectDotCount(participantFrame, 3);
    await page.waitForTimeout(150);
    await participantFrame.getByRole('button', { name: 'Undo' }).click();
    await expectDotCount(participantFrame, 2);
    await page.waitForTimeout(150);
    await participantFrame.getByRole('button', { name: 'Redo' }).click();
    await expectDotCount(participantFrame, 3);
    await page.waitForTimeout(150);
    await nextClick(page);

    await expect.poll(async () => {
      const storedReplay = await readRecordedReplay(page, demo.studyId);
      return storedReplay?.traversalTimes.length ?? 0;
    }, { timeout: 15000 }).toBeGreaterThanOrEqual(5);

    const recording = await readRecordedReplay(page, demo.studyId);
    if (!recording) {
      throw new Error(`No recorded replay found for ${demo.studyId}`);
    }

    const [initial, addTwo, addThree, undoTwo, redoThree] = recording.traversalTimes;
    const replayTargets = [
      { count: 1, time: (recording.startTime + addTwo) / 2 },
      { count: 2, time: (addTwo + addThree) / 2 },
      { count: 3, time: (addThree + undoTwo) / 2 },
      { count: 2, time: (undoTwo + redoThree) / 2 },
      { count: 3, time: (redoThree + recording.endTime) / 2 },
    ];

    expect(initial).toBeLessThanOrEqual(addTwo);
    await page.goto(`${replayPath}?participantId=${recording.participantId}&revisitPageId=e2e-trrack-replay`);

    const replayFrame = page.frameLocator('#root iframe');
    for (const target of replayTargets) {
      await seekReplay(page, recording.startTime, recording.endTime, target.time);
      await expectDotCount(replayFrame, target.count);
    }

    for (const target of [...replayTargets].reverse()) {
      await seekReplay(page, recording.startTime, recording.endTime, target.time);
      await expectDotCount(replayFrame, target.count);
    }
  });
}
