import { expect, test } from '@playwright/test';

test('parser errors are shown correctly', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('tab', { name: 'Tests' }).click();

  const errors = [
    'You have an error at /importedLibraries/: Could not find library test-missing - {"action":"make sure the library is in the correct location"}',
    'You have an error at /components/missingBaseComponent: Base component missingBaseComponent is not defined in baseComponents object - {"action":"add the base component to the baseComponents object"}',
    'You have an error at /components/missingComponentFromLibrary: Base component $test.co.test-missing is not defined in baseComponents object - {"action":"add the base component to the baseComponents object"}',
    'You have an error at /sequence/: Component missingComponent is not defined in components object - {"action":"add the component to the components object"}',
    'You have an error at /sequence/: Component testBaseComponent is a base component and cannot be used in the sequence - {"action":"add the component to the components object"}',
    'You have an error at /sequence/: Component nestedMissingComponent is not defined in components object - {"action":"add the component to the components object"}',
    'You have an error at /sequence/: Component $test.components.test-missing is not defined in components object - {"action":"add the component to the components object"}',
    'You have an error at /sequence/: Skip target md1 does not occur after the skip block it is used in - {"action":"add the target to the sequence after the skip block"}',
  ];

  for (const error of errors) {
    // eslint-disable-next-line no-console
    console.log(error);
    const e = page.getByText(error);
    // eslint-disable-next-line no-await-in-loop
    await expect(e).toBeVisible();
  }

  const warnings = [
    'Component testComponent is defined in components object but not used in the sequence - {"action":"remove the component from the components object or add it to the sequence"}',
  ];

  for (const warning of warnings) {
    // eslint-disable-next-line no-console
    console.log(warning);
    const w = page.getByText(warning);
    // eslint-disable-next-line no-await-in-loop
    await expect(w).toBeVisible();
  }

  const count = await page.getByLabel('Tests').locator('div').filter({ hasText: 'test-parser-errors' }).getByRole('list')
    .locator('li')
    .count();
  expect(count).toBe(errors.length + warnings.length);
});
