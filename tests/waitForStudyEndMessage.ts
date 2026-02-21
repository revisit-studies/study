import { expect, Page } from '@playwright/test';

const UPLOADING_MESSAGE = 'Please wait while your answers are uploaded.';
const COMPLETED_MESSAGE = /^Thank you for completing the study(\. You may close this window now\.)?$/;

export async function waitForStudyEndMessage(page: Page, timeout = 30000) {
  const uploading = page.getByText(UPLOADING_MESSAGE, { exact: true });
  const completed = page.getByText(COMPLETED_MESSAGE);

  await expect.poll(async () => (
    (await completed.isVisible()) || (await uploading.isVisible())
  ), { timeout }).toBe(true);

  if (!(await completed.isVisible())) {
    await expect(completed).toBeVisible({ timeout });
  }
}
