import { expect, test } from '@playwright/test';

test('auto-timeout settings confirm enablement and persist edits and disabling', async ({ page }) => {
  await page.goto('/analysis/stats/demo-html/live-monitor');
  const minutes = page.getByLabel('Auto-timeout minutes', { exact: true });
  const toggle = page.getByLabel('Enable auto-timeout', { exact: true });
  await expect(minutes).toBeEnabled();
  await expect(toggle).not.toBeChecked();

  await minutes.fill('30');
  await toggle.press('Space');
  const confirmation = page.getByRole('dialog', { name: 'Enable auto-timeout?' });
  await expect(confirmation).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await confirmation.getByRole('button', { name: 'Enable auto-timeout', exact: true }).click();
  await expect(confirmation).toBeHidden();
  await expect(toggle).toBeChecked();
  await expect(minutes).toBeEnabled();
  await page.reload();
  await expect(minutes).toBeEnabled();
  await expect(minutes).toHaveValue('30 minutes');
  await expect(toggle).toBeChecked();

  await minutes.fill('');
  await expect(minutes).toHaveValue('');
  await minutes.fill('45');
  await minutes.press('Tab');
  await expect(minutes).toBeEnabled();
  await expect(minutes).toHaveValue('45 minutes');
  await page.reload();
  await expect(minutes).toBeEnabled();
  await expect(minutes).toHaveValue('45 minutes');
  await expect(toggle).toBeChecked();

  await toggle.press('Space');
  await expect(toggle).not.toBeChecked();
  await expect(minutes).toBeEnabled();
  await page.reload();
  await expect(toggle).toBeEnabled();
  await expect(toggle).not.toBeChecked();
});
