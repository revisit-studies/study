/* eslint-disable no-await-in-loop */
import { test, expect, Page } from '@playwright/test';
import { nextClick, waitForStudyEndMessage } from './utils';

test.setTimeout(180000);

function getStudyMain(page: Page) {
  return page.getByRole('main');
}

async function selectRadioOption(page: Page, label: string, timeout = 10000) {
  const main = getStudyMain(page);
  await expect.poll(async () => {
    const radios = main.getByRole('radio', { name: label, exact: true });
    const count = await radios.count().catch(() => 0);

    for (let i = 0; i < count; i += 1) {
      const radio = radios.nth(i);
      const isVisible = await radio.isVisible().catch(() => false);
      const isEnabled = await radio.isEnabled().catch(() => false);
      if (isVisible && isEnabled) {
        await radio.check({ force: true }).catch(async () => {
          await radio.click({ force: true }).catch(() => {});
        });

        if (await radio.isChecked().catch(() => false)) {
          return true;
        }
      }
    }

    return false;
  }, { timeout }).toBe(true);
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

async function getNextParticipant(page: Page) {
  await page.locator('.studyBrowserMenuDropdown').click();
  await page.getByRole('menuitem', { name: 'Next Participant' }).click();
  await expect(page.getByText('Please answer the following questions')).toBeVisible();
}

async function goToCheck(page: Page, check: 'response' | 'responses' | 'attention-check-singular' | 'attention-check-block' | 'nested-responses' | 'nested-responses-block' | 'block-correct' | 'block-incorrect' | 'end') {
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

test('test', async ({ page }) => {
  await page.goto('/test-skip-logic');

  // Make sure that we loaded in
  const introText = await page.getByText('Please answer the following questions');
  await expect(introText).toBeVisible();

  // ***** All questions are correct *****
  await goToCheck(page, 'end');
  // Verify that the participant data has the block id as a tag
  const tags = await getTags(page);
  expect(tags).toContain('testBlockId');
  expect(tags).toContain('targetBlock');
  expect(tags).toHaveLength(2);
  await getNextParticipant(page);

  // ***** block-incorrect, block requires 2 incorrect to skip *****
  await goToCheck(page, 'block-incorrect');
  await answerTrial1(page, 'Blue', 'Dog'); // incorrect
  await answerTrial1(page, 'Blue', 'Dog'); // incorrect
  await verifyStudyEnd(page);
  await getNextParticipant(page);

  // ***** block-correct, block requires 2 correct to skip *****
  await goToCheck(page, 'block-correct');
  await answerTrial1(page, 'Blue', 'Cat'); // correct
  await answerTrial1(page, 'Blue', 'Cat'); // correct
  await verifyStudyEnd(page);
  await getNextParticipant(page);

  // ***** nested-responses, nested responses require 2 correct to skip *****
  await goToCheck(page, 'nested-responses');
  await verifyContinuingComponent(page);
  await answerTrial1(page, 'Blue', 'Dog'); // incorrect
  await verifyStudyEnd(page);
  await getNextParticipant(page);

  // ***** nested-responses-block, nested responses block requires 2 incorrect to skip *****
  await goToCheck(page, 'nested-responses-block');
  await answerTrial1(page, 'Blue', 'Dog'); // incorrect
  await answerTrial1(page, 'Blue', 'Dog'); // incorrect
  await verifyStudyEnd(page);
  await getNextParticipant(page);

  // ***** attention-check-block, attention check block requires 2 incorrect to skip *****
  await goToCheck(page, 'attention-check-block');
  await answerAttentionCheckBlock(page, 2);
  await verifyTargetBlockComponent(page);
  await verifyTargetComponent(page);
  await verifyStudyEnd(page);
  await getNextParticipant(page);

  // ***** attention-check-singular, attention check requires incorrect to skip *****
  await goToCheck(page, 'attention-check-singular');
  await answerAttentionCheck(page, 'No'); // incorrect
  await verifyStudyEnd(page);
  await getNextParticipant(page);

  // ***** responses, responses require incorrect to skip *****
  await goToCheck(page, 'responses');
  await answerTrial1(page, 'Blue', 'Dog'); // incorrect
  await verifyStudyEnd(page);
  await getNextParticipant(page);

  // ***** response, no must answer part of answer incorrect *****
  await goToCheck(page, 'response');
  await answerTrial1(page, 'Red', 'Cat'); // incorrect
  await verifyTargetComponent(page);
  await verifyStudyEnd(page);
  const tags2 = await getTags(page);
  expect(tags2).toHaveLength(0);
});
