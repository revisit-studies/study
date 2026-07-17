/* eslint-disable no-await-in-loop */
import {
  expect, test, type FrameLocator, type Page,
} from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
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

async function readStoredValue(page: Page, key: string) {
  return page.evaluate(async (storageKey) => new Promise<unknown>((resolve) => {
    const openRequest = indexedDB.open('revisit');

    openRequest.onerror = () => resolve(null);
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      if (!database.objectStoreNames.contains('keyvaluepairs')) {
        database.close();
        resolve(null);
        return;
      }

      const transaction = database.transaction('keyvaluepairs', 'readonly');
      const getRequest = transaction.objectStore('keyvaluepairs').get(storageKey);
      getRequest.onerror = () => resolve(null);
      getRequest.onsuccess = () => resolve(getRequest.result ?? null);
      transaction.oncomplete = () => database.close();
    };
  }), key);
}

async function readRecordedReplay(page: Page, studyId: string): Promise<RecordedReplay | null> {
  const assignments = await readStoredValue(page, `dev-${studyId}/sequenceAssignment`) as Record<string, unknown> | null;
  const participantId = Object.keys(assignments ?? {})[0];
  if (!participantId) {
    return null;
  }

  const participant = await readStoredValue(
    page,
    `dev-${studyId}/participants/${participantId}_participantData`,
  ) as { answers?: Record<string, { startTime?: number; endTime?: number }> } | null;
  const provenance = await readStoredValue(
    page,
    `dev-${studyId}/provenance/${participantId}_countDots_1`,
  ) as { stimulus?: { traversalEvents?: Array<{ createdOn?: number }> } } | null;
  const answer = participant?.answers?.countDots_1;
  const traversalTimes = provenance?.stimulus?.traversalEvents
    ?.map((event) => event.createdOn)
    .filter((createdOn): createdOn is number => typeof createdOn === 'number') ?? [];

  if (typeof answer?.startTime !== 'number' || typeof answer.endTime !== 'number') {
    return null;
  }

  return {
    participantId,
    startTime: answer.startTime,
    endTime: answer.endTime,
    traversalTimes,
  };
}

async function seekReplay(page: Page, recording: RecordedReplay, targetTime: number) {
  const timer = page.locator('footer svg').last();
  await expect(timer).toBeVisible();
  const timerBounds = await timer.boundingBox();
  if (!timerBounds) {
    throw new Error('Analysis replay timer has no bounds');
  }

  const fraction = (targetTime - recording.startTime) / (recording.endTime - recording.startTime);
  const x = 20 + Math.min(1, Math.max(0, fraction)) * (timerBounds.width - 40);
  await timer.click({ position: { x, y: timerBounds.height / 2 } });
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
      await seekReplay(page, recording, target.time);
      await expectDotCount(replayFrame, target.count);
    }

    for (const target of [...replayTargets].reverse()) {
      await seekReplay(page, recording, target.time);
      await expectDotCount(replayFrame, target.count);
    }
  });
}
