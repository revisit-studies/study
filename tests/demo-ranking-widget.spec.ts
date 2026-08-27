import {
  expect,
  test,
  Page,
  Locator,
} from '@playwright/test';
import {
  nextClick,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

async function getAvailableItemsZone(scope: Page | Locator) {
  return scope.locator('div.mantine-Paper-root[data-with-border="true"]')
    .filter({ hasText: 'Available Items' }).first();
}

async function dragWithMouse(
  page: Page,
  source: Locator,
  target: Locator,
  dropOnTargetCenter = false,
) {
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  const sourceX = (sourceBox as { x: number; width: number }).x + ((sourceBox as { width: number }).width / 2);
  const sourceY = (sourceBox as { y: number; height: number }).y + ((sourceBox as { height: number }).height / 2);

  const targetX = (targetBox as { x: number }).x + ((targetBox as { width: number }).width / 2);
  const targetHeight = (targetBox as { height: number }).height;
  const targetY = dropOnTargetCenter
    ? (targetBox as { y: number }).y + Math.min(24, targetHeight / 2)
    : (targetBox as { y: number }).y + Math.max(32, Math.min(targetHeight - 8, targetHeight * 0.65));

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(sourceX + 8, sourceY + 8);
  await page.mouse.move(targetX, targetY, { steps: 12 });
  await page.mouse.up();
}

async function getSublistSelectedDropZone(page: Page, zoneIndex = 0) {
  const selectedZone = page.locator('div.mantine-Paper-root[data-with-border="true"]').filter({
    has: page.getByText('HIGH', { exact: true }),
  }).filter({
    has: page.getByText('LOW', { exact: true }),
  }).nth(zoneIndex);
  return selectedZone;
}

async function getCategoricalZone(
  response: Locator,
  zone: 'HIGH' | 'MEDIUM' | 'LOW',
  zoneIndex = 0,
) {
  return response.locator('div.mantine-Paper-root[data-with-border="true"]')
    .filter({ hasText: zone }).nth(zoneIndex);
}

function getCategoricalResponse(page: Page, prompt: string) {
  return page.locator('[data-question-id]').filter({
    hasText: prompt,
  }).first();
}

function getZoneItem(zone: Locator, option: string) {
  return zone.getByText(option, { exact: true }).first()
    .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]');
}

async function expectItemInZone(zone: Locator, option: string) {
  await expect(zone.getByText(option, { exact: true })).toBeVisible();
}

async function expectItemAbsentFromZone(zone: Locator, option: string) {
  await expect(zone.getByText(option, { exact: true })).toHaveCount(0);
}

async function dragAvailableOptionToZone(
  page: Page,
  response: Locator,
  option: string,
  zone: 'HIGH' | 'MEDIUM' | 'LOW',
  zoneIndex = 0,
) {
  const availableZone = await getAvailableItemsZone(response);
  const source = availableZone.getByText(option, { exact: true }).first()
    .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]');
  const target = await getCategoricalZone(response, zone, zoneIndex);
  await dragWithMouse(page, source, target, true);
  await expectItemInZone(target, option);
  await expectItemAbsentFromZone(availableZone, option);
}

async function dragCategoricalOptionToZone(
  page: Page,
  response: Locator,
  option: string,
  sourceZoneName: 'HIGH' | 'MEDIUM' | 'LOW',
  targetZoneName: 'HIGH' | 'MEDIUM' | 'LOW',
) {
  const sourceZone = await getCategoricalZone(response, sourceZoneName);
  const targetZone = await getCategoricalZone(response, targetZoneName);
  await dragWithMouse(page, getZoneItem(sourceZone, option), targetZone, true);
  await expectItemInZone(targetZone, option);
  await expectItemAbsentFromZone(sourceZone, option);
}

async function dragFromAvailableInPairwise(
  page: Page,
  option: string,
  zone: 'HIGH' | 'LOW',
  pairIndex: number,
) {
  const availableZone = await getAvailableItemsZone(page);
  const source = availableZone.getByText(option, { exact: true }).first()
    .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]');
  const target = page.getByText(zone, { exact: true }).nth(pairIndex);
  await dragWithMouse(page, source, target);
}

async function settleAfterDrag(page: Page) {
  await page.waitForTimeout(250);
}

test('Test ranking response(sublist, categorical, pairwise) and validation', async ({ page }) => {
  await resetClientStudyState(page);
  await page.goto('/demo-ranking-widget');

  const nextParticipantButton = page.getByRole('button', { name: 'Next Participant' });
  if (await nextParticipantButton.isVisible()) {
    await nextParticipantButton.click();
  }

  await expect(page.getByText(/demo study.*ranking widget/i)).toBeVisible();

  await nextClick(page);

  // Sublist ranking
  // rank all options then re-order George Mason above Ball State
  await expect(page.getByText('Rank the following options.')).toBeVisible();
  const sublistDropZone = await getSublistSelectedDropZone(page);
  const availableZone = await getAvailableItemsZone(page);
  await dragWithMouse(
    page,
    availableZone.getByText('Ball State University', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    sublistDropZone,
  );
  await dragWithMouse(
    page,
    availableZone.getByText('University of Rochester', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    sublistDropZone,
  );
  await dragWithMouse(
    page,
    availableZone.getByText('George Mason University', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    sublistDropZone,
  );
  await dragWithMouse(
    page,
    availableZone.getByText('University of California - Berkeley', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    sublistDropZone,
  );
  await dragWithMouse(
    page,
    availableZone.getByText('Washington State University', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    sublistDropZone,
  );
  await settleAfterDrag(page);

  await dragWithMouse(
    page,
    page.getByText('George Mason University', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    page.getByText('Ball State University', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
  );
  await settleAfterDrag(page);

  await nextClick(page);

  // Sublist ranking top-3
  // put 3 items, then verify adding one more is blocked
  await expect(page.getByText('Rank the following options, selecting the top 3 options.')).toBeVisible();
  const sublistTop3DropZone = await getSublistSelectedDropZone(page);
  const availableZoneTop3 = await getAvailableItemsZone(page);
  await dragWithMouse(
    page,
    availableZoneTop3.getByText('University of Rochester', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    sublistTop3DropZone,
  );
  await dragWithMouse(
    page,
    availableZoneTop3.getByText('George Mason University', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    sublistTop3DropZone,
  );
  await dragWithMouse(
    page,
    availableZoneTop3.getByText('Ball State University', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    sublistTop3DropZone,
  );
  await dragWithMouse(
    page,
    availableZoneTop3.getByText('University of California - Berkeley', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    sublistTop3DropZone,
  );
  await settleAfterDrag(page);
  await nextClick(page);
  await expect(page.getByText('Please add at most 3 items.')).toBeVisible();
  await expect(sublistTop3DropZone.locator('.mantine-Paper-root')).toHaveCount(4);
  await dragWithMouse(
    page,
    sublistTop3DropZone.getByText('University of California - Berkeley', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    availableZoneTop3.getByText('Available Items', { exact: true }),
    true,
  );
  await settleAfterDrag(page);
  await dragWithMouse(
    page,
    sublistTop3DropZone.getByText('University of Rochester', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    availableZoneTop3.getByText('Available Items', { exact: true }),
    true,
  );
  await settleAfterDrag(page);
  await expect(sublistTop3DropZone.locator('.mantine-Paper-root')).toHaveCount(2);
  await nextClick(page);
  await expect(page.getByText('Please add at most 3 items.')).not.toBeVisible();

  // Categorical ranking
  // Put 2 in high, 2 in medium, 1 in low, then move one from medium to high
  await expect(page.getByText('Rank the following options.')).toBeVisible();
  const categoricalResponse = getCategoricalResponse(page, 'Rank the following options.');
  await dragAvailableOptionToZone(page, categoricalResponse, 'Ball State University', 'HIGH');
  await dragAvailableOptionToZone(page, categoricalResponse, 'University of Rochester', 'HIGH');
  await dragAvailableOptionToZone(page, categoricalResponse, 'George Mason University', 'MEDIUM');
  await dragAvailableOptionToZone(page, categoricalResponse, 'University of California - Berkeley', 'MEDIUM');
  await dragAvailableOptionToZone(page, categoricalResponse, 'Washington State University', 'LOW');
  await dragCategoricalOptionToZone(page, categoricalResponse, 'George Mason University', 'MEDIUM', 'HIGH');

  await nextClick(page);

  // Categorical ranking top-2
  // Put 2 in high, then attempt a 3rd in medium to trigger limit
  await expect(page.getByText('Rank the following options. Select the top 2 options.')).toBeVisible();
  const top2Response = getCategoricalResponse(page, 'Rank the following options. Select the top 2 options.');
  await dragAvailableOptionToZone(page, top2Response, 'Ball State University', 'HIGH');
  await dragAvailableOptionToZone(page, top2Response, 'University of Rochester', 'HIGH');
  await dragAvailableOptionToZone(page, top2Response, 'George Mason University', 'MEDIUM');
  await dragAvailableOptionToZone(page, top2Response, 'University of California - Berkeley', 'MEDIUM');
  await dragAvailableOptionToZone(page, top2Response, 'Washington State University', 'MEDIUM');

  const top2MediumZone = await getCategoricalZone(top2Response, 'MEDIUM');
  await expect(top2MediumZone.locator('div.mantine-Paper-root[data-with-border="true"]')).toHaveCount(3);
  await expectItemInZone(top2MediumZone, 'George Mason University');
  await expectItemInZone(top2MediumZone, 'University of California - Berkeley');
  await expectItemInZone(top2MediumZone, 'Washington State University');
  await nextClick(page);
  await expect(page.getByText('Please add at most 2 items per category.')).toBeVisible();
  await expect(page.getByText('Rank the following options. Select the top 2 options.')).toBeVisible();

  const top2AvailableZone = await getAvailableItemsZone(top2Response);
  await dragWithMouse(
    page,
    getZoneItem(top2MediumZone, 'Washington State University'),
    top2AvailableZone.getByText('Available Items', { exact: true }),
    true,
  );
  await expectItemInZone(top2AvailableZone, 'Washington State University');
  await expectItemAbsentFromZone(top2MediumZone, 'Washington State University');
  await expect(top2MediumZone.locator('div.mantine-Paper-root[data-with-border="true"]')).toHaveCount(2);
  await expect(page.getByText('Please add at most 2 items per category.')).toHaveCount(0);
  await nextClick(page);

  // Pairwise ranking
  // duplicate pair check, then valid non-duplicate pair and clear validation
  await expect(page.getByText('Rank the following options by pairing them up.')).toBeVisible();
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  await dragFromAvailableInPairwise(page, 'Ball State University', 'HIGH', 0);
  await settleAfterDrag(page);
  // An incomplete pair (HIGH filled, LOW empty) should not allow progression
  await nextButton.click();
  await expect(page.getByText('Please complete at least one pair to continue.')).toBeVisible();
  await expect(page.getByText('Rank the following options by pairing them up.')).toBeVisible();
  // Revealing errors smooth-scrolls to the unresolved question; wait for the
  // scroll to settle so the next drag's coordinates are stable.
  await page.waitForTimeout(600);
  await dragFromAvailableInPairwise(page, 'University of Rochester', 'LOW', 0);
  await settleAfterDrag(page);
  await expect(page.getByText('Please complete at least one pair to continue.')).toHaveCount(0);

  await page.getByRole('button', { name: 'Add New Pair' }).click();
  await dragFromAvailableInPairwise(page, 'Ball State University', 'HIGH', 1);
  await settleAfterDrag(page);
  await dragFromAvailableInPairwise(page, 'University of Rochester', 'LOW', 1);
  await settleAfterDrag(page);
  await expect(page.getByText('This would create a duplicate pair.')).toBeVisible();

  await dragFromAvailableInPairwise(page, 'George Mason University', 'LOW', 1);
  await settleAfterDrag(page);
  await expect(page.getByText('This would create a duplicate pair.')).toHaveCount(0);

  await nextClick(page);

  await waitForStudyEndMessage(page);
});
