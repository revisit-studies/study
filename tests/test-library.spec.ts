import { expect, test } from '@playwright/test';

test('parser errors are shown correctly', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Using library imports Authors' }).click();

  expect(await page.getByText('test md file')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  expect(await page.getByText('test react file')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  expect(await page.getByText('test md file')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  expect(await page.getByText('test md file')).toBeVisible();
  expect(await page.getByText('What did you think of the')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  expect(await page.getByText('test md file')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  expect(await page.getByText('test react file')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  expect(await page.getByText('test md file')).toBeVisible();
  expect(await page.getByText('What did you think of the')).toBeVisible();
  await page.getByLabel('What did you think of the').fill('123');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  expect(await page.getByText('test md file')).toBeVisible();
  expect(await page.getByText('What did you think of the')).toBeVisible();
  await page.getByLabel('What did you think of the').fill('123');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  expect(await page.getByText('test md file')).toBeVisible();
  expect(await page.getByText('What did you think of the')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
});
