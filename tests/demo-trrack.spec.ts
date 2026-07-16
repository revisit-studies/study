/* eslint-disable no-await-in-loop */
import { expect, test, type FrameLocator } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
} from './utils';

const demos = [
  'HTML with Trrack library',
  'Svelte with Trrack library',
] as const;

async function expectDotCount(frame: FrameLocator, count: number) {
  await expect(frame.locator('circle')).toHaveCount(count);
}

for (const demoTitle of demos) {
  test(`${demoTitle} initializes its answer and enforces dot limits`, async ({ page }) => {
    await resetClientStudyState(page);
    await openStudyFromLanding(page, 'Demo Studies', demoTitle);
    await nextClick(page);

    const frame = page.frameLocator('#root iframe');
    const addButton = frame.getByRole('button', { name: 'Add' });
    const removeButton = frame.getByRole('button', { name: 'Remove' });

    await expectDotCount(frame, 1);
    await expect(page.getByRole('listitem').filter({ hasText: '1' })).toHaveCount(1);

    for (let count = 1; count < 20; count += 1) {
      await addButton.click();
    }

    await expectDotCount(frame, 20);
    await expect(addButton).toBeDisabled();
    await addButton.locator('..').hover();
    await expect(frame.getByRole('tooltip')).toBeVisible();
    await expect(frame.getByRole('tooltip')).toHaveText('Maximum of 20 dots reached.');

    await removeButton.click();
    await expect(addButton).toBeEnabled();
    await addButton.click();

    for (let count = 20; count > 0; count -= 1) {
      await removeButton.click();
    }

    await expectDotCount(frame, 0);
    await expect(removeButton).toBeDisabled();
    await removeButton.locator('..').hover();
    await expect(frame.getByRole('tooltip')).toBeVisible();
    await expect(frame.getByRole('tooltip')).toHaveText('Minimum of 0 dots reached.');

    await frame.getByRole('button', { name: 'Undo' }).click();
    await expectDotCount(frame, 1);
    await expect(removeButton).toBeEnabled();
    await frame.getByRole('button', { name: 'Redo' }).click();
    await expectDotCount(frame, 0);
  });
}
