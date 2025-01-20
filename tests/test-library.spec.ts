import { expect, test } from '@playwright/test';

test('parser errors are shown correctly', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('tab', { name: 'Tests' }).click();

  await page.getByLabel('Tests').locator('div').filter({ hasText: 'Using library imports' })
    .getByText('Go to Study')
    .click();

  await page.waitForSelector('text=test md file', { state: 'visible', timeout: 5000 });
  const testText = await page.getByText('test md file');
  expect(testText).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(100);

  expect(await page.getByText('test react file')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(100);

  expect(await page.getByText('test md file')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(100);

  expect(await page.getByText('test md file')).toBeVisible();
  expect(await page.getByText('What did you think of the')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(100);

  expect(await page.getByText('test md file')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(100);

  expect(await page.getByText('test react file')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(100);

  expect(await page.getByText('test md file')).toBeVisible();
  expect(await page.getByText('What did you think of the')).toBeVisible();
  await page.getByLabel('What did you think of the').fill('123');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(100);

  expect(await page.getByText('test md file')).toBeVisible();
  expect(await page.getByText('What did you think of the')).toBeVisible();
  await page.getByLabel('What did you think of the').fill('123');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(100);

  expect(await page.getByText('test md file')).toBeVisible();
  expect(await page.getByText('What did you think of the')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
});
