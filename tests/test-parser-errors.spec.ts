import { expect, test } from '@playwright/test';

test('parser errors are shown correctly', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('tab', { name: 'Tests' }).click();

  // Locate the test-parser-errors study card
  const studyCard = page.locator('div').filter({ hasText: /^test-parser-errors/ }).first();

  const errors = [
    'root:Could not find library test-missing',
    '/baseComponents/:Base component missingBaseComponent and $test.components.test-missing are not defined in baseComponents object',
    '/components/:Component missingComponent, nestedMissingComponent, $test.components.test-missing, and $test.sequences.missingSequence are not defined in components object',
    '/importedLibraries/test/sequence/:Sequence missingSequence not found in library test',
    '/sequence/:Component testBaseComponent is a base component and cannot be used in the sequence',
    '/sequence/:Skip target md1 does not occur after the skip block it is used in',
  ];

  for (const error of errors) {
    // eslint-disable-next-line no-console
    console.log(error);
    const e = studyCard.getByText(error);
    // eslint-disable-next-line no-await-in-loop
    await expect(e).toBeVisible();
  }

  // Click on warning box to open warning list
  await studyCard.getByRole('button', { name: /Warnings/ }).click();

  const warnings = [
    '/sequence/:Sequence has an empty components array',
    '/components/:Component testComponent is defined in components object but not used deterministically in the sequence',
    '/components/:Component sidebarComponent uses sidebar locations but sidebar is disabled',
    '/uiConfig/:Component sidebarUiConfig uses sidebar locations but sidebar is disabled',
  ];

  for (const warning of warnings) {
    // eslint-disable-next-line no-console
    console.log(warning);
    const w = studyCard.getByText(warning);
    // eslint-disable-next-line no-await-in-loop
    await expect(w).toBeVisible();
  }

  const count = await studyCard.getByRole('list')
    .locator('li')
    .count();
  expect(count).toBe(errors.length + warnings.length);
});
