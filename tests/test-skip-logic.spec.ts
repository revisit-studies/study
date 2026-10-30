/* eslint-disable no-await-in-loop */
import {
  expect,
  Page,
  test,
} from '@playwright/test';
import { advanceStudyStep as advanceStep, readStoredValue, waitForStudyEndMessage } from './utils';

test.setTimeout(180000);

type SkipCheck = 'response' | 'responses' | 'attention-check-singular' | 'attention-check-block' | 'nested-responses' | 'nested-responses-block' | 'block-correct' | 'block-incorrect' | 'end';

function getStudyMain(page: Page) {
  return page.getByRole('main');
}

async function selectRadioOption(page: Page, label: string, timeout = 10000) {
  const main = getStudyMain(page);
  const radio = main.getByRole('radio', { name: label, exact: true }).filter({ visible: true });
  await radio.check({ timeout });
  await expect(radio).toBeChecked({ timeout });
}

async function answerTrial1(page: Page, q1: string, q2: string) {
  await selectRadioOption(page, q1);
  await selectRadioOption(page, q2);
  await advanceStep(page);
}

async function answerAttentionCheck(page: Page, q1: string) {
  await selectRadioOption(page, q1);
  await advanceStep(page);
}

async function answerAttentionCheckBlock(page: Page, numIncorrect: number) {
  const numCorrect = 3 - numIncorrect;
  const answers = [...Array(numCorrect).fill('Yes'), ...Array(numIncorrect).fill('No')].sort(() => Math.random() - 0.5);

  let stillToComplete = numIncorrect;
  for (const answer of answers) {
    await answerTrial1(page, 'Blue', 'Cat');
    await answerAttentionCheck(page, answer);
    if (answer === 'No') {
      stillToComplete -= 1;
    }

    if (stillToComplete === 0 && numIncorrect !== 0) {
      return;
    }
  }

  await answerTrial1(page, 'Blue', 'Cat');
}

async function verifyContinuingComponent(page: Page) {
  await expect(page.getByText('This component exists to show that we didn\'t get skipped over.')).toBeVisible();
  await advanceStep(page);
}

async function verifyTargetComponent(page: Page) {
  await expect(page.getByText('This component exists to show that we can choose where to skip to.')).toBeVisible();
  await advanceStep(page);
}

async function verifyTargetBlockComponent(page: Page) {
  await expect(page.getByText('This component exists to show that we can choose a block to skip to.')).toBeVisible();
  await advanceStep(page);
}

async function verifyStudyEnd(page: Page) {
  await waitForStudyEndMessage(page);
}

async function startSkipLogicStudy(page: Page) {
  await page.goto('/test-skip-logic');
  await expect(page.getByTestId('study-interface')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(page.getByText('Please answer the following questions')).toBeVisible({ timeout: 30000 });
}

async function goToCheck(page: Page, check: SkipCheck) {
  if (check === 'response') {
    return;
  }
  await answerTrial1(page, 'Blue', 'Cat');
  await verifyContinuingComponent(page);

  if (check === 'responses') {
    return;
  }
  await answerTrial1(page, 'Blue', 'Cat');
  await verifyContinuingComponent(page);

  if (check === 'attention-check-singular') {
    return;
  }
  await answerAttentionCheck(page, 'Yes');
  await answerTrial1(page, 'Blue', 'Cat');
  await verifyContinuingComponent(page);

  if (check === 'attention-check-block') {
    return;
  }

  await answerAttentionCheckBlock(page, 0);
  await verifyContinuingComponent(page);

  if (check === 'nested-responses') {
    return;
  }
  await verifyContinuingComponent(page);
  await answerTrial1(page, 'Blue', 'Cat');
  await verifyContinuingComponent(page);

  await verifyContinuingComponent(page);

  if (check === 'nested-responses-block') {
    return;
  }

  await answerTrial1(page, 'Blue', 'Cat');
  await answerTrial1(page, 'Blue', 'Cat');
  await answerTrial1(page, 'Blue', 'Cat');
  await verifyContinuingComponent(page);

  await verifyContinuingComponent(page);

  if (check === 'block-correct') {
    return;
  }
  await answerTrial1(page, 'Red', 'Cat');
  await answerTrial1(page, 'Red', 'Cat');
  await answerTrial1(page, 'Red', 'Cat');

  await verifyContinuingComponent(page);

  if (check === 'block-incorrect') {
    return;
  }
  await answerTrial1(page, 'Blue', 'Cat');
  await answerTrial1(page, 'Blue', 'Cat');
  await answerTrial1(page, 'Blue', 'Cat');

  await verifyContinuingComponent(page);
  await verifyTargetBlockComponent(page);
  await verifyTargetComponent(page);
  await verifyStudyEnd(page);

  if (check === 'end') {
    // eslint-disable-next-line no-useless-return
    return;
  }
}

async function getTags(page: Page) {
  const participantId = await readStoredValue<string>(page, 'dev-test-skip-logic/currentParticipantId');
  const participant = await readStoredValue<{ participantTags: string[] }>(page, `dev-test-skip-logic/participants/${participantId}_participantData`);
  return participant?.participantTags ?? [];
}

test('evaluates the all-correct skip path', async ({ page }) => {
  await startSkipLogicStudy(page);
  await goToCheck(page, 'end');
  await expect.poll(() => getTags(page), { timeout: 15000 }).toEqual(expect.arrayContaining(['testBlockId', 'targetBlock']));
  const tags = await getTags(page);
  expect(tags).toContain('testBlockId');
  expect(tags).toContain('targetBlock');
  expect(tags).toHaveLength(2);
});

test('evaluates the block-incorrect skip path', async ({ page }) => {
  await startSkipLogicStudy(page);
  await goToCheck(page, 'block-incorrect');
  await answerTrial1(page, 'Blue', 'Dog');
  await answerTrial1(page, 'Blue', 'Dog');
  await verifyStudyEnd(page);
});

test('evaluates the block-correct skip path', async ({ page }) => {
  await startSkipLogicStudy(page);
  await goToCheck(page, 'block-correct');
  await answerTrial1(page, 'Blue', 'Cat');
  await answerTrial1(page, 'Blue', 'Cat');
  await verifyStudyEnd(page);
});

test('evaluates the nested-responses skip path', async ({ page }) => {
  await startSkipLogicStudy(page);
  await goToCheck(page, 'nested-responses');
  await verifyContinuingComponent(page);
  await answerTrial1(page, 'Blue', 'Dog');
  await verifyStudyEnd(page);
});

test('evaluates the nested-responses-block skip path', async ({ page }) => {
  await startSkipLogicStudy(page);
  await goToCheck(page, 'nested-responses-block');
  await answerTrial1(page, 'Blue', 'Dog');
  await answerTrial1(page, 'Blue', 'Dog');
  await verifyStudyEnd(page);
});

test('evaluates the attention-check-block skip path', async ({ page }) => {
  await startSkipLogicStudy(page);
  await goToCheck(page, 'attention-check-block');
  await answerAttentionCheckBlock(page, 2);
  await verifyTargetBlockComponent(page);
  await verifyTargetComponent(page);
  await verifyStudyEnd(page);
});

test('evaluates the attention-check-singular skip path', async ({ page }) => {
  await startSkipLogicStudy(page);
  await goToCheck(page, 'attention-check-singular');
  await answerAttentionCheck(page, 'No');
  await verifyStudyEnd(page);
});

test('evaluates the responses skip path', async ({ page }) => {
  await startSkipLogicStudy(page);
  await goToCheck(page, 'responses');
  await answerTrial1(page, 'Blue', 'Dog');
  await verifyStudyEnd(page);
});

test('evaluates the response skip path without a target tag', async ({ page }) => {
  await startSkipLogicStudy(page);
  await goToCheck(page, 'response');
  await answerTrial1(page, 'Red', 'Cat');
  await verifyTargetComponent(page);
  await verifyStudyEnd(page);
  const tags2 = await getTags(page);
  expect(tags2).toHaveLength(0);
});
