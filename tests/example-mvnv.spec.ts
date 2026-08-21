/* eslint-disable no-await-in-loop */
import { test, expect, Page } from '@playwright/test';
import {
  nextClick,
  readStoredValue,
  seekReplay,
  waitForStudyEndMessage,
} from './utils';

test.setTimeout(300000);

const MVNV_TASK_TIMEOUT_MS = 15000;
const MVNV_TRANSITION_TIMEOUT_MS = 15000;
const MVNV_END_STATE_TIMEOUT_MS = 60000;

async function getCurrentTaskQuestion(page: Page) {
  const question = page.locator('p').filter({ has: page.locator('strong:has-text("Question:")') }).first();
  if (!(await question.isVisible().catch(() => false))) {
    return '';
  }
  return ((await question.innerText().catch(() => '')).replace(/^Question:\s*/i, '').trim());
}

async function waitForMvnvProgress(
  page: Page,
  previousQuestion: string,
  isFinished: () => Promise<boolean>,
  timeout: number,
) {
  try {
    await expect.poll(async () => {
      if (await isFinished()) {
        return true;
      }
      const nextQuestion = await getCurrentTaskQuestion(page);
      return Boolean(nextQuestion && nextQuestion !== previousQuestion);
    }, { timeout }).toBe(true);
  } catch (error) {
    const currentQuestion = await getCurrentTaskQuestion(page);
    const body = await page.locator('body').innerText().catch(() => '');
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error([
      `MVNV did not reach study end or a new task within ${timeout}ms.`,
      `URL: ${page.url()}`,
      `Previous question: ${previousQuestion || '<none>'}`,
      `Current question: ${currentQuestion || '<none>'}`,
      `Visible body tail: ${body.slice(-2000)}`,
      reason,
    ].join('\n'));
  }
}

type MvnvAnswer = {
  answer?: Record<string, unknown>;
  componentName?: string;
  endTime?: number;
  startTime?: number;
};

type MvnvReplaySetup = {
  participantId: string;
  recording: MvnvAnswer & { identifier: string };
};

async function readFirstMvnvRecording(page: Page): Promise<MvnvReplaySetup | null> {
  const assignments = await readStoredValue<Record<string, unknown>>(
    page,
    'dev-example-mvnv/sequenceAssignment',
  );
  const participantId = Object.keys(assignments ?? {})[0];
  if (!participantId) {
    return null;
  }

  const participant = await readStoredValue<{ answers?: Record<string, MvnvAnswer> }>(
    page,
    `dev-example-mvnv/participants/${participantId}_participantData`,
  );
  const recording = Object.entries(participant?.answers ?? {})
    .map(([identifier, answer]) => ({ ...answer, identifier }))
    .filter((answer) => (
      answer.componentName?.startsWith('task')
      && Array.isArray(answer.answer?.['iframe-task'])
      && typeof answer.startTime === 'number'
      && typeof answer.endTime === 'number'
    ))
    .sort((left, right) => left.startTime! - right.startTime!)[0];

  return recording ? { participantId, recording } : null;
}

async function answerCurrentMvnvPrompt(
  page: Page,
  taskTimeoutMs = MVNV_TASK_TIMEOUT_MS,
  startingQuestion = '',
) {
  const deadline = Date.now() + taskTimeoutMs;
  const iframe = page.frameLocator('#root iframe');
  const answerBoxes = iframe.locator('.answerBox rect');
  const answerCheckboxes = iframe.getByRole('checkbox');
  const answerInput = page.getByPlaceholder('answer text');
  const findingsInput = page.getByLabel('Enter Findings Below*');
  const radioOptions = page.getByRole('radio');
  const task6Prompt = page.getByText('Does Alex have more mention interactions with North American or European accounts?');
  const selectedItems = page.locator('p:has-text("Selected name(s) will show here")')
    .locator('xpath=following-sibling::*[1]')
    .getByRole('listitem');
  const clickedRects = new Set<number>();

  const hasReactiveSelection = async () => {
    const checkboxCount = await answerCheckboxes.count().catch(() => 0);
    for (let i = 0; i < Math.min(checkboxCount, 10); i += 1) {
      const checkbox = answerCheckboxes.nth(i);
      if (
        await checkbox.isVisible().catch(() => false)
        && await checkbox.isChecked().catch(() => false)
      ) {
        return true;
      }
    }

    const count = await selectedItems.count().catch(() => 0);
    for (let i = 0; i < Math.min(count, 10); i += 1) {
      const item = selectedItems.nth(i);
      if (
        await item.isVisible().catch(() => false)
        && (await item.innerText().catch(() => '')).trim().length > 0
      ) {
        return true;
      }
    }
    return false;
  };

  const selectReactiveAnswer = async (attempt = 0) => {
    const checkboxCount = await answerCheckboxes.count().catch(() => 0);
    for (let i = 0; i < Math.min(checkboxCount, 10); i += 1) {
      const checkbox = answerCheckboxes.nth(i);
      if (await checkbox.isVisible().catch(() => false)) {
        const checked = await checkbox.isChecked().catch(() => false);
        if (!checked) {
          await checkbox.check().catch(async () => {
            await checkbox.click().catch(() => { });
          });
          return true;
        }
      }
    }

    const answerBoxCount = await answerBoxes.count().catch(() => 0);
    const limit = Math.min(answerBoxCount, 10);
    for (let i = 0; i < limit; i += 1) {
      const idx = (attempt + i) % limit;
      if (!clickedRects.has(idx)) {
        await answerBoxes.nth(idx).click().catch(() => { });
        clickedRects.add(idx);
        return true;
      }
    }
    return false;
  };

  await expect.poll(async () => {
    if (await answerBoxes.first().isVisible().catch(() => false)) {
      return true;
    }
    const radioCount = await radioOptions.count().catch(() => 0);
    for (let i = 0; i < Math.min(radioCount, 10); i += 1) {
      if (await radioOptions.nth(i).isVisible().catch(() => false)) {
        return true;
      }
    }
    return (await answerInput.isVisible().catch(() => false))
      || (await findingsInput.isVisible().catch(() => false))
      || (await answerBoxes.first().isVisible().catch(() => false));
  }, { timeout: taskTimeoutMs }).toBe(true);

  // Task 6 needs BOTH a radio response and a reactive graph-node selection.
  if (await task6Prompt.isVisible().catch(() => false)) {
    const radioCount = await radioOptions.count().catch(() => 0);
    for (let i = 0; i < Math.min(radioCount, 10); i += 1) {
      const radio = radioOptions.nth(i);
      if (await radio.isVisible().catch(() => false)) {
        await radio.check();
        break;
      }
    }

    let i = 0;
    while (Date.now() < deadline) {
      if (startingQuestion) {
        const currentQuestion = await getCurrentTaskQuestion(page);
        if (currentQuestion && currentQuestion !== startingQuestion) {
          return;
        }
      }
      if (await hasReactiveSelection()) {
        return;
      }

      const answerBoxCount = await answerBoxes.count().catch(() => 0);
      if (answerBoxCount > 0) {
        await selectReactiveAnswer(i);
      }
      i += 1;
    }
  }

  // Some prompts require both a sidebar response and a graph-node selection.
  let textsFilled = false;
  let attempt = 0;
  while (Date.now() < deadline) {
    if (startingQuestion) {
      const currentQuestion = await getCurrentTaskQuestion(page);
      if (currentQuestion && currentQuestion !== startingQuestion) {
        return;
      }
    }

    if (!textsFilled) {
      if (await answerInput.isVisible().catch(() => false)) {
        await answerInput.fill('test');
      }
      if (await findingsInput.isVisible().catch(() => false)) {
        await findingsInput.fill('test');
      }
      const radioCount = await radioOptions.count().catch(() => 0);
      for (let i = 0; i < Math.min(radioCount, 10); i += 1) {
        const radio = radioOptions.nth(i);
        if (await radio.isVisible().catch(() => false)) {
          await radio.check();
          break;
        }
      }
      textsFilled = true;
    }

    const answerBoxCount = await answerBoxes.count().catch(() => 0);
    const hasSelection = await hasReactiveSelection();
    if (answerBoxCount === 0) {
      return;
    }
    if (hasSelection) {
      return;
    }
    await selectReactiveAnswer(attempt);
    attempt += 1;
  }
}

test('completes the full MVNV participant flow @slow-mvnv', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Skipping MVNV on WebKit due to headless flakiness.');

  const taskTimeoutMs = MVNV_TASK_TIMEOUT_MS;
  const maxTaskLoops = 20;
  const taskZeroQuestion = 'Find the North American with the most Tweets';
  let sawTaskZero = false;

  await page.goto('/');

  await page.getByRole('tab', { name: 'Example Studies' }).click();

  // Click on mvnv study
  await page.getByLabel('Example Studies').locator('div').filter({ hasText: 'MVNV Study Replication' })
    .getByText('Go to Study')
    .click();

  await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();

  // Click on next button
  await nextClick(page);

  // Check for consent page
  const consentText = await page.getByRole('heading', { name: 'Consent' });
  await expect(consentText).toBeVisible();

  // Fill in consent form
  await page.getByPlaceholder('Please provide your signature').fill('test');
  await page.getByLabel('Accept').check();

  // Click on next button
  await page.getByRole('button', { name: 'Agree' }).click();

  // Check training page
  const trainingText = await page.frameLocator('#root iframe').getByRole('heading', { name: 'Adjacency Matrix Training' });
  await expect(trainingText).toBeVisible();
  const trainingVideo = await page.frameLocator('#root iframe').locator('video');
  await expect(trainingVideo).toBeVisible();
  await nextClick(page);

  const defaultCompleted = page.getByText('Thank you for completing the study. You may close this window now.', { exact: true });
  const prolificCompleted = page.getByText(/Thank you for completing the study\.\s*You may click this link and return to Prolific/i);
  const uploading = page.getByText('Please wait while your answers are uploaded.', { exact: true });
  const isFinished = async () => (
    (await page.url()).includes('end')
    || (await page.locator('body').innerText().catch(() => '')).includes('Thank you for completing the study.')
    || (await page.locator('body').innerText().catch(() => '')).includes('Please wait while your answers are uploaded.')
    || await defaultCompleted.isVisible().catch(() => false)
    || await prolificCompleted.isVisible().catch(() => false)
    || await uploading.isVisible().catch(() => false)
  );

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < maxTaskLoops; i++) {
    if (await isFinished()) {
      break;
    }

    const qText = page.getByText('Task:Question:');
    if (!(await qText.isVisible().catch(() => false))) {
      // If this isn't a task view and also not an end/uploading view yet, allow one short settle pass.
      await page.waitForTimeout(250);
      if (await isFinished()) {
        break;
      }
      await expect(qText).toBeVisible({ timeout: taskTimeoutMs });
    }
    const questionBefore = await getCurrentTaskQuestion(page);
    // Check if the current question is the task zero question
    if (questionBefore === taskZeroQuestion) {
      await expect(page.getByText(taskZeroQuestion)).toBeVisible();
      sawTaskZero = true;
    }
    await answerCurrentMvnvPrompt(page, taskTimeoutMs, questionBefore);
    if (await isFinished()) {
      break;
    }
    await nextClick(page, taskTimeoutMs);
    await waitForMvnvProgress(
      page,
      questionBefore,
      isFinished,
      MVNV_TRANSITION_TIMEOUT_MS,
    );
  }

  expect(sawTaskZero).toBe(true);

  // Check that the thank you message is displayed
  await waitForStudyEndMessage(page, MVNV_END_STATE_TIMEOUT_MS);
});

test('replays a seeded MVNV task without completing the full study', async ({ page, browserName }) => {
  test.setTimeout(120000);
  test.skip(browserName === 'webkit', 'Skipping MVNV on WebKit due to headless flakiness.');

  await page.goto('/');
  await page.getByRole('tab', { name: 'Example Studies' }).click();
  await page.getByLabel('Example Studies').locator('div').filter({ hasText: 'MVNV Study Replication' })
    .getByText('Go to Study')
    .click();
  await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();
  await nextClick(page);
  await expect(page.getByRole('heading', { name: 'Consent' })).toBeVisible();
  await page.getByPlaceholder('Please provide your signature').fill('test');
  await page.getByLabel('Accept').check();
  await page.getByRole('button', { name: 'Agree' }).click();

  await expect(page.frameLocator('#root iframe').getByRole('heading', { name: 'Adjacency Matrix Training' })).toBeVisible();
  await nextClick(page);
  await expect(page.getByText('Task:Question:')).toBeVisible({ timeout: MVNV_TASK_TIMEOUT_MS });

  const firstTaskParticipantPath = new URL(page.url()).pathname;
  const questionBefore = await getCurrentTaskQuestion(page);
  await answerCurrentMvnvPrompt(page, MVNV_TASK_TIMEOUT_MS, questionBefore);
  await nextClick(page, MVNV_TASK_TIMEOUT_MS);

  let replaySetup: MvnvReplaySetup | null = null;
  await expect.poll(async () => {
    replaySetup = await readFirstMvnvRecording(page);
    return Boolean(replaySetup);
  }, { timeout: 15000 }).toBe(true);
  if (!replaySetup) {
    throw new Error('No MVNV task recording was persisted after the short replay setup.');
  }

  const { participantId, recording } = replaySetup;
  const participantKey = `dev-example-mvnv/participants/${participantId}_participantData`;
  const provenanceKey = `dev-example-mvnv/provenance/${participantId}_${recording.identifier}`;
  await expect.poll(async () => readStoredValue(page, provenanceKey), { timeout: 15000 }).not.toBeNull();
  const participantBeforeReplay = await readStoredValue(page, participantKey);
  const provenanceBeforeReplay = await readStoredValue(page, provenanceKey);

  await page.goto(`${firstTaskParticipantPath}?participantId=${participantId}&revisitPageId=e2e-mvnv-replay`);
  await expect(page.locator('#root iframe')).toHaveCount(1, { timeout: 15000 }).catch(async () => {
    throw new Error(`MVNV replay did not render an iframe at ${page.url()}: ${await page.locator('body').innerText()}`);
  });
  const replayFrame = page.frameLocator('#root iframe');
  const selectedAnswerBoxCount = () => replayFrame.locator('.answerBox rect').evaluateAll((rects) => (
    rects.filter((rect) => getComputedStyle(rect).fill !== 'rgb(255, 255, 255)').length
  ));

  await seekReplay(page, recording.startTime!, recording.endTime!, recording.endTime!);
  await expect.poll(selectedAnswerBoxCount, { timeout: 15000 }).toBeGreaterThan(0);
  await expect.poll(async () => replayFrame.locator('.answer').count(), { timeout: 15000 }).toBeGreaterThan(0);

  await seekReplay(page, recording.startTime!, recording.endTime!, recording.startTime!);
  await expect.poll(selectedAnswerBoxCount, { timeout: 15000 }).toBe(0);
  expect(await readStoredValue(page, participantKey)).toEqual(participantBeforeReplay);
  expect(await readStoredValue(page, provenanceKey)).toEqual(provenanceBeforeReplay);
});
