import { expect, Page } from '@playwright/test';

const UPLOADING_MESSAGE = 'Please wait while your answers are uploaded.';
const DEFAULT_COMPLETED_MESSAGE = 'Thank you for completing the study. You may close this window now.';
const PROLIFIC_COMPLETED_MESSAGE = /Thank you for completing the study\.\s*You may click this link and return to Prolific/i;

export async function nextClick(page: Page, timeout = 10000) {
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  await expect(nextButton).toBeVisible({ timeout });
  await expect(nextButton).toBeEnabled({ timeout });
  await nextButton.click({ timeout: 2000 });
}

export async function waitForStudyEndMessage(page: Page, timeout = 30000) {
  const uploading = page.getByText(UPLOADING_MESSAGE, { exact: true });
  const defaultCompleted = page.getByText(DEFAULT_COMPLETED_MESSAGE, { exact: true });
  const prolificCompleted = page.getByText(PROLIFIC_COMPLETED_MESSAGE);

  await expect.poll(async () => (
    (await defaultCompleted.isVisible())
    || (await prolificCompleted.isVisible())
    || (await uploading.isVisible())
  ), { timeout }).toBe(true);

  if (!(await defaultCompleted.isVisible()) && !(await prolificCompleted.isVisible())) {
    await expect(defaultCompleted.or(prolificCompleted)).toBeVisible({ timeout });
  }
}
