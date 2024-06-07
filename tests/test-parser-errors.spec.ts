import { expect, test } from '@playwright/test';

test('parser errors are shown correctly', async ({ page }) => {
  await page.goto('/');

  const e1 = await page.getByText('You have an error at /components/missingBaseComponent: Base component missingBaseComponent is not defined in baseComponents object - {"action":"add the base component to the baseComponents object"}');
  await expect(e1).toBeVisible();

  const e2 = await page.getByText('You have an error at /sequence/: Component missingComponent is not defined in components object - {"action":"add the component to the components object"}');
  await expect(e2).toBeVisible();

  const e3 = await page.getByText('You have an error at /sequence/: Component testBaseComponent is a base component and cannot be used in the sequence - {"action":"add the component to the components object"}');
  await expect(e3).toBeVisible();

  const e4 = await page.getByText('You have an error at /sequence/: Component nestedMissingComponent is not defined in components object - {"action":"add the component to the components object"}');
  await expect(e4).toBeVisible();

  const e5 = await page.getByText('You have an error at /sequence/: Skip target md1 does not occur after the skip block it is used in - {"action":"add the target to the sequence after the skip block"}');
  await expect(e5).toBeVisible();
});
