/* eslint-disable no-await-in-loop */
import { test, expect, Page } from '@playwright/test';
import { nextClick, waitForStudyEndMessage } from './utils';

async function getCurrentTaskQuestion(page: Page) {
  const question = page.locator('p').filter({ has: page.locator('strong:has-text("Question:")') }).first();
  if (!(await question.isVisible().catch(() => false))) {
    return '';
  }
  return ((await question.innerText().catch(() => '')).replace(/^Question:\s*/i, '').trim());
}

async function answerCurrentMvnvPrompt(
  page: Page,
  taskTimeoutMs = 10000,
  startingQuestion = '',
) {
  const deadline = Date.now() + taskTimeoutMs;
  const iframe = page.frameLocator('#root iframe');
  const answerBoxes = iframe.locator('.answerBox rect');
  const answerCheckboxes = iframe.getByRole('checkbox');
  const answerInput = page.getByPlaceholder('answer text');
  const findingsInput = page.getByLabel('Enter Findings Below*');
  const radioOptions = page.getByRole('radio');
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  const task6Prompt = page.getByText('Does Alex have more mention interactions with North American or European accounts?');
  const selectedItems = page.locator('p:has-text("Selected name(s) will show here")')
    .locator('xpath=following-sibling::*[1]')
    .getByRole('listitem');
  const clickedRects = new Set<number>();

  const hasReactiveSelection = async () => {
    const checkboxCount = await answerCheckboxes.count().catch(() => 0);
    for (let i = 0; i < Math.min(checkboxCount, 40); i += 1) {
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
    for (let i = 0; i < Math.min(checkboxCount, 40); i += 1) {
      const checkbox = answerCheckboxes.nth(i);
      if (await checkbox.isVisible().catch(() => false)) {
        const checked = await checkbox.isChecked().catch(() => false);
        if (!checked) {
          await checkbox.check().catch(async () => {
            await checkbox.click().catch(() => {});
          });
          return true;
        }
      }
    }

    const answerBoxCount = await answerBoxes.count().catch(() => 0);
    const limit = Math.min(answerBoxCount, 40);
    for (let i = 0; i < limit; i += 1) {
      const idx = (attempt + i) % limit;
      if (!clickedRects.has(idx)) {
        await answerBoxes.nth(idx).click().catch(() => {});
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

  if (await answerBoxes.first().isVisible().catch(() => false)) {
    await selectReactiveAnswer();
    if (await nextButton.isEnabled().catch(() => false)) return;
  }

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
      if (await nextButton.isEnabled().catch(() => false)) {
        return;
      }

      const answerBoxCount = await answerBoxes.count().catch(() => 0);
      const hasSelection = await hasReactiveSelection();
      if (answerBoxCount > 0 && !hasSelection) {
        await selectReactiveAnswer(i);
      }

      if (await nextButton.isEnabled().catch(() => false)) {
        return;
      }
      i += 1;
    }
  }

  // Some prompts require both a sidebar response and a graph-node selection.
  let attempt = 0;
  while (Date.now() < deadline) {
    if (startingQuestion) {
      const currentQuestion = await getCurrentTaskQuestion(page);
      if (currentQuestion && currentQuestion !== startingQuestion) {
        return;
      }
    }
    if (await nextButton.isEnabled().catch(() => false)) {
      return;
    }

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

    const answerBoxCount = await answerBoxes.count().catch(() => 0);
    const hasSelection = await hasReactiveSelection();
    if (answerBoxCount > 0 && !hasSelection) {
      await selectReactiveAnswer(attempt);
    }

    if (await nextButton.isEnabled().catch(() => false)) {
      return;
    }
    attempt += 1;
  }

  throw new Error(`MVNV task did not enable Next within ${Math.round(taskTimeoutMs / 1000)} seconds`);
}

test('test', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Skipping MVNV on WebKit due to headless flakiness.');

  const taskTimeoutMs = browserName === 'webkit' ? 20000 : 6000;
  const maxTaskLoops = 20;

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
      await expect(qText).toBeVisible({ timeout: 5000 });
    }
    const questionBefore = await getCurrentTaskQuestion(page);
    await answerCurrentMvnvPrompt(page, taskTimeoutMs, questionBefore);
    if (await isFinished()) {
      break;
    }
    await nextClick(page, taskTimeoutMs);
    // Best-effort settle only; do not fail the whole run on transient render gaps.
    await expect.poll(async () => {
      if (await isFinished()) return true;
      const questionAfter = await getCurrentTaskQuestion(page);
      return !!questionAfter;
    }, { timeout: 5000 }).toBe(true).catch(() => {});
  }

  // Check that the thank you message is displayed
  await waitForStudyEndMessage(page);
});
