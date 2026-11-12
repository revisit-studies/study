import { expect, test, Page } from '@playwright/test';
import { nextClick, openStudyFromLanding, resetClientStudyState } from './utils';

async function openSliderTrial(page: Page) {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'How To Do Training Demo');
  await nextClick(page);

  const mark = page.getByPlaceholder('Choose mark');
  await expect(mark).toBeVisible();
  await mark.click();
  await page.getByRole('option', { name: 'Bar', exact: true }).click();
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('You have answered the question correctly.');
  await nextClick(page);
  await expect(page.getByRole('slider')).toBeVisible();
}

async function setSliderValue(page: Page, value: number) {
  const slider = page.getByRole('slider');
  const minimum = Number(await slider.getAttribute('aria-valuemin'));
  const maximum = Number(await slider.getAttribute('aria-valuemax'));
  const track = page.locator('.mantine-Slider-track').filter({ has: slider });
  const box = await track.boundingBox();
  if (!box || !Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum) {
    throw new Error('Could not determine slider bounds');
  }

  await track.click({ position: { x: ((value - minimum) / (maximum - minimum)) * box.width, y: box.height / 2 } });
  await expect(slider).toHaveAttribute('aria-valuenow', String(value));
}

test('the demo-training slider keeps exact answers marked correct and allows progression', async ({ page }) => {
  await openSliderTrial(page);
  await setSliderValue(page, 25);
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Correct Answer');
  await expect(alert).toContainText('You have answered the question correctly.');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await nextClick(page);
  await expect(page.getByRole('checkbox', { name: 'A', exact: true })).toBeVisible();
});

test('the demo-training slider shows almost-correct feedback and allows progression', async ({ page }) => {
  await openSliderTrial(page);
  await setSliderValue(page, 22);
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Almost Correct');
  await expect(alert).toContainText('The correct answer is 25');
  await expect(alert).toContainText('within an acceptable margin of error');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await nextClick(page);
  await expect(page.getByRole('checkbox', { name: 'A', exact: true })).toBeVisible();
});

test('the demo-training slider still rejects values outside the configured ranges', async ({ page }) => {
  await openSliderTrial(page);
  await setSliderValue(page, 21);
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('Incorrect Answer');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
});

test('the standalone almost-correct demo is listed and shows inclusive slider feedback', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Tests', 'Almost Correct Feedback Test');
  await nextClick(page);
  await expect(page.getByRole('slider')).toBeVisible();
  await setSliderValue(page, 55);
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Almost Correct');
  await expect(alert).toContainText('The correct answer is 60');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
});
