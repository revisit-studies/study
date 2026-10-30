/* eslint-disable no-await-in-loop */
import { test, expect, Page } from '@playwright/test';
import {
  nextClick,
  readStoredValue,
  seekReplay,
  waitForStudyEndMessage,
} from './utils';

test.setTimeout(300000);

const MVNV_TASK_COUNT = 16;
const MVNV_STARTUP_TIMEOUT_MS = 30000;
const MVNV_TASK_TIMEOUT_MS = 15000;
const MVNV_TRANSITION_TIMEOUT_MS = 15000;
const MVNV_END_STATE_TIMEOUT_MS = 60000;

async function getCurrentTaskQuestion(page: Page) {
  const question = page.locator('p').filter({ has: page.locator('strong:has-text("Question:")') }).first();
  const text = await question.evaluateAll((elements) => {
    const element = elements[0] as HTMLElement | undefined;
    return element?.getClientRects().length ? element.innerText : '';
  });
  return text.replace(/^Question:\s*/i, '').trim();
}

async function withMvnvContext(page: Page, summary: string, wait: () => Promise<void>) {
  try {
    await wait();
  } catch (error) {
    const currentQuestion = await getCurrentTaskQuestion(page);
    const body = await page.locator('body').innerText().catch(() => '');
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error([
      summary,
      `URL: ${page.url()}`,
      `Current question: ${currentQuestion || '<none>'}`,
      `Visible body tail: ${body.slice(-2000)}`,
      reason,
    ].join('\n'));
  }
}

async function openMvnvStudy(page: Page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Example Studies' }).click();
  await page.getByLabel('Example Studies').locator('div').filter({ hasText: 'MVNV Study Replication' })
    .getByText('Go to Study')
    .click();

  await withMvnvContext(page, `MVNV study did not finish starting within ${MVNV_STARTUP_TIMEOUT_MS}ms.`, async () => {
    await expect(page).toHaveURL(/\/example-mvnv(?:[/?#]|$)/, { timeout: MVNV_STARTUP_TIMEOUT_MS });
    await expect(page.getByTestId('study-interface')).toHaveAttribute('aria-busy', 'false', { timeout: MVNV_STARTUP_TIMEOUT_MS });
    await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible({ timeout: MVNV_STARTUP_TIMEOUT_MS });
  });
}

async function waitForMvnvProgress(
  page: Page,
  previousQuestion: string,
  isFinished: () => Promise<boolean>,
  timeout: number,
) {
  await withMvnvContext(page, `MVNV did not reach study end or a new task after "${previousQuestion || '<none>'}" within ${timeout}ms.`, async () => {
    await expect.poll(async () => {
      if (await isFinished()) {
        return true;
      }
      const nextQuestion = await getCurrentTaskQuestion(page);
      return Boolean(nextQuestion && nextQuestion !== previousQuestion);
    }, { timeout }).toBe(true);
  });
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

async function answerCurrentMvnvPrompt(page: Page, timeout = MVNV_TASK_TIMEOUT_MS) {
  const responses = page.locator('[data-question-id]');
  const answerBoxes = page.frameLocator('#root iframe').locator('.answerBox rect');

  await withMvnvContext(page, `MVNV task responses did not render within ${timeout}ms.`, async () => {
    await expect(responses.first()).toBeVisible({ timeout });
  });

  for (const response of await responses.all()) {
    const questionId = await response.getAttribute('data-question-id');
    const radios = response.getByRole('radio');
    const textbox = response.getByRole('textbox');

    if (questionId === 'iframe-task') {
      const selectedItems = response.getByRole('listitem');
      await withMvnvContext(page, `MVNV did not record a graph-node selection within ${timeout}ms.`, async () => {
        await expect(answerBoxes.first()).toBeVisible({ timeout });
        let nextNode = 0;
        await expect(async () => {
          if (await selectedItems.count() === 0) {
            await answerBoxes.nth(nextNode).click({ timeout: 2000 });
            nextNode += 1;
          }
          await expect(selectedItems.first()).toBeVisible({ timeout: 2000 });
        }).toPass({ timeout });
      });
    } else if (await radios.count() > 0) {
      await radios.first().check();
    } else if (await textbox.count() > 0) {
      await textbox.fill('test');
      await expect(textbox).toHaveValue('test');
    } else {
      throw new Error(`Unhandled MVNV response "${questionId}" at ${page.url()}`);
    }
  }
}

test('completes the full MVNV participant flow @slow-mvnv', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Skipping MVNV on WebKit due to headless flakiness.');

  const taskTimeoutMs = MVNV_TASK_TIMEOUT_MS;
  const maxTaskLoops = 20;
  const taskZeroQuestion = 'Find the North American with the most Tweets';
  let sawTaskZero = false;

  await openMvnvStudy(page);

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

  const isFinished = async () => {
    const body = await page.locator('body').innerText().catch(() => '');
    return body.includes('Thank you for completing the study.')
      || body.includes('Please wait while your answers are uploaded.');
  };
  const taskQuestion = page.getByText('Task:Question:');
  const answeredQuestions = new Set<string>();

  for (let i = 0; i < maxTaskLoops; i += 1) {
    await withMvnvContext(page, `MVNV showed neither a task nor the study end within ${taskTimeoutMs}ms.`, async () => {
      await expect.poll(async () => (await isFinished()) || (await taskQuestion.isVisible()), { timeout: taskTimeoutMs }).toBe(true);
    });
    if (await isFinished()) {
      break;
    }

    const questionBefore = await getCurrentTaskQuestion(page);
    // Check if the current question is the task zero question
    if (questionBefore === taskZeroQuestion) {
      await expect(page.getByText(taskZeroQuestion)).toBeVisible();
      sawTaskZero = true;
    }
    await answerCurrentMvnvPrompt(page, taskTimeoutMs);
    await withMvnvContext(page, `MVNV Next button was not clickable for "${questionBefore}" within ${taskTimeoutMs}ms.`, async () => {
      await nextClick(page, taskTimeoutMs);
    });
    answeredQuestions.add(questionBefore);
    await waitForMvnvProgress(
      page,
      questionBefore,
      isFinished,
      MVNV_TRANSITION_TIMEOUT_MS,
    );
  }

  expect(answeredQuestions.size).toBe(MVNV_TASK_COUNT);
  expect(sawTaskZero).toBe(true);

  // Check that the thank you message is displayed
  await waitForStudyEndMessage(page, MVNV_END_STATE_TIMEOUT_MS);
});

test('replays a seeded MVNV task without completing the full study', async ({ page, browserName }) => {
  test.setTimeout(120000);
  test.skip(browserName === 'webkit', 'Skipping MVNV on WebKit due to headless flakiness.');

  await openMvnvStudy(page);
  await nextClick(page);
  await expect(page.getByRole('heading', { name: 'Consent' })).toBeVisible();
  await page.getByPlaceholder('Please provide your signature').fill('test');
  await page.getByLabel('Accept').check();
  await page.getByRole('button', { name: 'Agree' }).click();

  await expect(page.frameLocator('#root iframe').getByRole('heading', { name: 'Adjacency Matrix Training' })).toBeVisible();
  await nextClick(page);
  await expect(page.getByText('Task:Question:')).toBeVisible({ timeout: MVNV_TASK_TIMEOUT_MS });

  const firstTaskParticipantPath = new URL(page.url()).pathname;
  await answerCurrentMvnvPrompt(page);
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
  await expect.poll(async () => replayFrame.locator('.answerBox').count(), { timeout: 15000 }).toBeGreaterThan(0);
  const selectedAnswerBoxCount = () => replayFrame.locator('.answerBox rect').evaluateAll((rects) => (
    rects.filter((rect) => getComputedStyle(rect).fill !== 'rgb(255, 255, 255)').length
  ));

  await seekReplay(page, recording.startTime!, recording.endTime!, recording.endTime!, async () => (
    (await selectedAnswerBoxCount()) > 0
    && await replayFrame.locator('.answer').count() > 0
  ));
  await expect.poll(selectedAnswerBoxCount, { timeout: 15000 }).toBeGreaterThan(0);
  await expect.poll(async () => replayFrame.locator('.answer').count(), { timeout: 15000 }).toBeGreaterThan(0);

  await seekReplay(page, recording.startTime!, recording.endTime!, recording.startTime!, async () => (
    (await selectedAnswerBoxCount()) === 0
  ));
  await expect.poll(selectedAnswerBoxCount, { timeout: 15000 }).toBe(0);
  expect(await readStoredValue(page, participantKey)).toEqual(participantBeforeReplay);
  expect(await readStoredValue(page, provenanceKey)).toEqual(provenanceBeforeReplay);
});
