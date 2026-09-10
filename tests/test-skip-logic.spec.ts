/* eslint-disable no-await-in-loop */
import {
  expect,
  Locator,
  Page,
  test,
} from '@playwright/test';
import { nextClick, waitForStudyEndMessage } from './utils';

test.setTimeout(180000);

type SkipCheck = 'response' | 'responses' | 'attention-check-singular' | 'attention-check-block' | 'nested-responses' | 'nested-responses-block' | 'block-correct' | 'block-incorrect' | 'end';

function getStudyMain(page: Page) {
  return page.getByRole('main');
}

async function selectRadioOption(page: Page, label: string, timeout = 10000) {
  const main = getStudyMain(page);
  let availableRadio: Locator | undefined;

  await expect.poll(async () => {
    const radios = main.getByRole('radio', { name: label, exact: true });
    const count = await radios.count().catch(() => 0);

    for (let i = 0; i < count; i += 1) {
      const radio = radios.nth(i);
      const isVisible = await radio.isVisible().catch(() => false);
      const isEnabled = await radio.isEnabled().catch(() => false);
      if (isVisible && isEnabled) {
        availableRadio = radio;
        return true;
      }
    }

    return false;
  }, { timeout, intervals: [100, 250, 500, 1000] }).toBe(true);

  if (!availableRadio) {
    throw new Error(`Could not find an available radio option for "${label}".`);
  }

  await availableRadio.check({ force: true });
  await expect(availableRadio).toBeChecked({ timeout });
}

async function answerTrial1(page: Page, q1: string, q2: string) {
  await selectRadioOption(page, q1);
  await selectRadioOption(page, q2);
  await nextClick(page);
}

async function answerAttentionCheck(page: Page, q1: string) {
  await selectRadioOption(page, q1);
  await nextClick(page);
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
  await nextClick(page);
}

async function verifyTargetComponent(page: Page) {
  await expect(page.getByText('This component exists to show that we can choose where to skip to.')).toBeVisible();
  await nextClick(page);
}

async function verifyTargetBlockComponent(page: Page) {
  await expect(page.getByText('This component exists to show that we can choose a block to skip to.')).toBeVisible();
  await nextClick(page);
}

async function verifyStudyEnd(page: Page) {
  await waitForStudyEndMessage(page);
}

async function startSkipLogicStudy(page: Page) {
  await page.goto('/test-skip-logic');
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
  return page.evaluate(async () => {
    let db;
    const request = indexedDB.open('revisit');

    return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      request.onsuccess = async (event: any) => {
        db = event.target.result;
        const transaction = db.transaction(['keyvaluepairs'], 'readonly');
        const store = transaction.objectStore('keyvaluepairs');
        // const sequenceArrayInternal = store.get('sequenceArray');
        // sequenceArrayInternal.onsuccess = () => resolve(sequenceArrayInternal.result);
        const currentParticipant = store.get('dev-test-skip-logic/currentParticipantId');
        currentParticipant.onsuccess = () => {
          const participantData = store.get(`dev-test-skip-logic/participants/${currentParticipant.result}_participantData`);
          participantData.onsuccess = () => {
            const { participantTags } = participantData.result;
            resolve(participantTags);
          };
        };
      };
    });
  });
}

test('evaluates the all-correct skip path', async ({ page }) => {
  await startSkipLogicStudy(page);
  await goToCheck(page, 'end');
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
