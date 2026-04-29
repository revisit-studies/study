import { expect, test } from '@playwright/test';
import {
  nextClick,
  resetClientStudyState,
} from './utils';

test('parser errors are shown correctly', async ({ page }) => {
  await resetClientStudyState(page);
  await page.goto('/');

  await page.getByRole('tab', { name: 'Tests' }).click();

  await page.getByLabel('Tests').locator('div').filter({ hasText: 'Using library imports' })
    .getByText('Go to Study')
    .click();

  await page.waitForSelector('text=test md file', { state: 'visible', timeout: 15000 });
  const testText = page.getByText('test md file');
  await expect(testText).toBeVisible({ timeout: 15000 });
  await nextClick(page);
  await page.waitForTimeout(100);

  await expect(page.getByText('test react file')).toBeVisible();
  await nextClick(page);
  await page.waitForTimeout(100);

  await expect(page.getByText('test md file')).toBeVisible();
  await nextClick(page);
  await page.waitForTimeout(100);

  await expect(page.getByText('test md file')).toBeVisible();
  await expect(page.getByText('What did you think of the')).toBeVisible();
  await nextClick(page);
  await page.waitForTimeout(100);

  await expect(page.getByText('test md file')).toBeVisible();
  await nextClick(page);
  await page.waitForTimeout(100);

  await expect(page.getByText('test react file')).toBeVisible();
  await nextClick(page);
  await page.waitForTimeout(100);

  await expect(page.getByText('test md file')).toBeVisible();
  await expect(page.getByText('What did you think of the')).toBeVisible();
  await page.getByLabel('What did you think of the').fill('123');
  await nextClick(page);
  await page.waitForTimeout(100);

  await expect(page.getByText('test md file')).toBeVisible();
  await expect(page.getByText('What did you think of the')).toBeVisible();
  await page.getByLabel('What did you think of the').fill('123');
  await nextClick(page);
  await page.waitForTimeout(100);

  await expect(page.getByText('test md file')).toBeVisible();
  await expect(page.getByText('What did you think of the')).toBeVisible();
  await nextClick(page);
});
