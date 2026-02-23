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

async function getAvailableItemsZone(page: Page) {
  return page.locator('div.mantine-Paper-root[data-with-border="true"]').filter({
    has: page.getByText('Available Items', { exact: true }),
  }).first();
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

  const targetX = (targetBox as { x: number; width: number }).x + ((targetBox as { width: number }).width / 2);
  const targetHeight = (targetBox as { height: number }).height;
  const targetY = dropOnTargetCenter
    ? (targetBox as { y: number }).y + (targetHeight / 2)
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

async function getCategoricalOrPairwiseDropZone(
  page: Page,
  zone: 'HIGH' | 'MEDIUM' | 'LOW',
  zoneIndex = 0,
) {
  return page.locator('p.mantine-Text-root').filter({
    hasText: new RegExp(`^${zone}$`),
  }).nth(zoneIndex);
}

async function dragAvailableOptionToZone(
  page: Page,
  option: string,
  zone: 'HIGH' | 'MEDIUM' | 'LOW',
  zoneIndex = 0,
) {
  const availableZone = await getAvailableItemsZone(page);
  const source = availableZone.getByText(option, { exact: true }).first()
    .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]');
  const target = await getCategoricalOrPairwiseDropZone(page, zone, zoneIndex);
  await dragWithMouse(page, source, target, true);
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
  await expect(page.getByText('You can only add up to 3 items.')).toBeVisible();
  await nextClick(page);

  // Categorical ranking
  // Put 2 in high, 2 in medium, 1 in low, then move one from medium to high
  await expect(page.getByText('Rank the following options.')).toBeVisible();
  await dragAvailableOptionToZone(page, 'Ball State University', 'HIGH');
  await dragAvailableOptionToZone(page, 'University of Rochester', 'HIGH');
  await dragAvailableOptionToZone(page, 'George Mason University', 'MEDIUM');
  await dragAvailableOptionToZone(page, 'University of California - Berkeley', 'MEDIUM');
  await dragAvailableOptionToZone(page, 'Washington State University', 'LOW');
  await settleAfterDrag(page);

  await dragWithMouse(
    page,
    page.getByText('George Mason University', { exact: true }).first()
      .locator('xpath=ancestor::div[contains(@class,"mantine-Paper-root")][1]'),
    await getCategoricalOrPairwiseDropZone(page, 'HIGH'),
  );
  await settleAfterDrag(page);

  await nextClick(page);

  // Categorical ranking top-2
  // Put 2 in high, then attempt a 3rd in medium to trigger limit
  await expect(page.getByText('Rank the following options. Select the top 2 options.')).toBeVisible();
  await dragAvailableOptionToZone(page, 'Ball State University', 'HIGH');
  await dragAvailableOptionToZone(page, 'University of Rochester', 'HIGH');
  await dragAvailableOptionToZone(page, 'George Mason University', 'MEDIUM');
  await dragAvailableOptionToZone(page, 'University of California - Berkeley', 'MEDIUM');
  await dragAvailableOptionToZone(page, 'Washington State University', 'MEDIUM');
  await settleAfterDrag(page);
  // In some browsers the 3rd drop is ignored without rendering a toast;
  // ensure we still have at least one option left in "Available Items".
  await expect((await getAvailableItemsZone(page)).getByText('Washington State University', { exact: true })).toBeVisible();

  await nextClick(page);

  // Pairwise ranking
  // duplicate pair check, then valid non-duplicate pair and clear validation
  await expect(page.getByText('Rank the following options by pairing them up.')).toBeVisible();
  await dragFromAvailableInPairwise(page, 'Ball State University', 'HIGH', 0);
  await dragFromAvailableInPairwise(page, 'University of Rochester', 'LOW', 0);
  await settleAfterDrag(page);

  await page.getByRole('button', { name: 'Add New Pair' }).click();
  await dragFromAvailableInPairwise(page, 'Ball State University', 'HIGH', 1);
  await dragFromAvailableInPairwise(page, 'University of Rochester', 'LOW', 1);
  await settleAfterDrag(page);
  await expect(page.getByText('This would create a duplicate pair.')).toBeVisible();

  await dragFromAvailableInPairwise(page, 'George Mason University', 'LOW', 1);
  await settleAfterDrag(page);
  await expect(page.getByText('This would create a duplicate pair.')).toHaveCount(0);

  await nextClick(page);

  await waitForStudyEndMessage(page);
});
