/* eslint-disable no-await-in-loop */
// Participant journeys must finish each action before advancing to the next trial.
import { expect, test } from '@playwright/test';
import budgetStudy from '../public/test-global-store/config.json' with { type: 'json' };
import { nextClick } from './utils';
import {
  expectBudget, fillCost, openGlobalStoreStudy, readGlobalStoreParticipant, startBudgetStudy, submitFormPurchase,
} from './global-store.utils';

test('runs forms, React, HTML, repeated and dynamic trials with committed store values', async ({ page }) => {
  await startBudgetStudy(page);
  await submitFormPurchase(page, 10, 15, 5);
  await expectBudget(page, 70);
  await expect(page.getByText('React entry budget: 70', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await fillCost(page, 'Confidence', 80);
  await expectBudget(page, 70);
  await nextClick(page);
  await expectBudget(page, 50);

  const frame = page.frameLocator('iframe');
  await expect(frame.getByText('HTML entry budget: 50', { exact: true })).toBeVisible();
  await frame.getByRole('button', { name: 'Spend 10', exact: true }).click();
  await expect(frame.getByRole('button', { name: 'Spend 10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await nextClick(page);
  await expectBudget(page, 40);
  await expect(frame.getByText('Template entry budget: 40', { exact: true })).toBeVisible();
  await frame.getByRole('button', { name: 'Spend 10', exact: true }).click();
  await nextClick(page);
  await expectBudget(page, 30);
  await submitFormPurchase(page, 5);
  await expectBudget(page, 25);
  await expect(page.getByRole('heading', { name: 'Dynamic purchase 1', exact: true })).toBeVisible();
  await fillCost(page, 'Dynamic cost', 5);
  await nextClick(page);
  await expectBudget(page, 20);
  await expect(page.getByRole('heading', { name: 'Dynamic purchase 2', exact: true })).toBeVisible();
  await fillCost(page, 'Dynamic cost', 5);
  await nextClick(page);
  await expectBudget(page, 15);
  await nextClick(page);
  await expect(page.getByRole('heading', { name: 'Low budget branch', exact: true })).toBeVisible();
  await nextClick(page);
  await expect(page.getByText('Final budget: 15', { exact: true })).toBeVisible();
  await expect.poll(async () => (await readGlobalStoreParticipant(page))?.globalVariables?.budget).toBe(15);
});

test('rejects aggregate overspending across response locations without partially committing', async ({ page }) => {
  await startBudgetStudy(page);
  const path = new URL(page.url()).pathname;
  await submitFormPurchase(page, 60, 50);
  await expect(page.getByRole('alert').filter({ hasText: /budget/i })).toBeVisible();
  await expectBudget(page, 100);
  expect(new URL(page.url()).pathname).toBe(path);
  const saved = await readGlobalStoreParticipant(page);
  expect(saved?.globalVariables?.budget ?? 100).toBe(100);
  expect(Object.values(saved?.answers ?? {}).some((answer: { componentName: string; endTime: number }) => answer.componentName === 'purchase' && answer.endTime > 0)).toBe(false);
  await submitFormPurchase(page, 60, 40);
  await expectBudget(page, 0);
});

test('evaluates primitive operations and preserves false, zero, hidden and optional values', async ({ page }) => {
  await openGlobalStoreStudy(page, 'test-global-store-operations');
  await expect(page.getByRole('heading', { name: 'Primitive operations', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Conditional cost$/ })).toHaveCount(0);
  await nextClick(page);
  const expected = {
    numberSet: 3,
    numberAdd: 15,
    numberSubtract: 9,
    numberMultiply: 36,
    numberDivide: 4,
    stringSet: 'X',
    stringAppend: 'midX',
    stringPrepend: 'Xmid',
    booleanSet: false,
    booleanAnd: false,
    booleanOr: true,
    booleanToggle: false,
    orderedNumber: 36,
  };
  for (const [key, value] of Object.entries(expected)) {
    await expect(page.getByText(`${key}: ${value}`, { exact: true })).toBeVisible();
  }
  await expectBudget(page, 100);
  await expect.poll(async () => (await readGlobalStoreParticipant(page, 'test-global-store-operations'))?.globalVariables).toMatchObject(expected);
});

test('accepts zero as an operand and rejects division by zero atomically', async ({ page }) => {
  await openGlobalStoreStudy(page, 'test-global-store-operations');
  await fillCost(page, 'numberSet', 0);
  await fillCost(page, 'numberDivide', 0);
  await nextClick(page);
  await expect(page.getByRole('alert').filter({ hasText: /zero|finite|divide/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Primitive operations', exact: true })).toBeVisible();
  await fillCost(page, 'numberDivide', 3);
  await nextClick(page);
  await expect(page.getByText('numberSet: 0', { exact: true })).toBeVisible();
  await expect(page.getByText('numberDivide: 4', { exact: true })).toBeVisible();
});

test('programmatic submission respects form gates and async updater failures can be retried', async ({ page }) => {
  await openGlobalStoreStudy(page, 'test-global-store-failures');
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await page.getByRole('button', { name: 'Submit purchase', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Updater failures', exact: true })).toBeVisible();
  await expectBudget(page, 100);
  await fillCost(page, 'Confidence', 50);
  await page.getByRole('checkbox', { name: 'Reject update', exact: true }).check();
  await nextClick(page);
  await expect(page.getByRole('alert').filter({ hasText: /could not be calculated/i })).toBeVisible();
  await expectBudget(page, 100);
  await page.getByRole('checkbox', { name: 'Reject update', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Submit purchase', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'After updater', exact: true })).toBeVisible();
  await expectBudget(page, 80);
});

test('timeout advancement discards a proposed form deduction', async ({ page }) => {
  await openGlobalStoreStudy(page, 'test-global-store-failures');
  await page.getByRole('button', { name: 'Spend 0', exact: true }).click();
  await fillCost(page, 'Confidence', 50);
  await nextClick(page);
  await expect(page.getByRole('heading', { name: 'After updater', exact: true })).toBeVisible();
  await nextClick(page);
  await expect(page.getByRole('heading', { name: 'Timeout purchase', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'After timeout', exact: true })).toBeVisible();
  await expectBudget(page, 100);
});

test('finalized sessions reopen at the end card even through an earlier route', async ({ page }) => {
  await openGlobalStoreStudy(page, 'test-global-store-operations');
  const earlierUrl = page.url();
  await nextClick(page);
  await nextClick(page);
  await expect(page.getByText('Global store study complete.', { exact: true })).toBeVisible();
  await page.goto(earlierUrl);
  await expect(page.getByText('Global store study complete.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /^numberSet/ })).toHaveCount(0);
});

test('new participants start with the declared values', async ({ page }) => {
  await startBudgetStudy(page);
  await submitFormPurchase(page, 30);
  await expectBudget(page, 70);
  await page.getByRole('button', { name: 'Next Participant', exact: true }).click();
  await expectBudget(page, 100);
});

test('rejects form and stimulus writers of the same key, then accepts after the optional operand is cleared', async ({ page }) => {
  await openGlobalStoreStudy(page, 'test-global-store-failures');
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await fillCost(page, 'Confidence', 80);
  await fillCost(page, 'Conflicting cost', 5);
  await nextClick(page);
  await expect(page.getByRole('alert').filter({ hasText: /conflict.*budget/i })).toBeVisible();
  await expectBudget(page, 100);
  await page.getByRole('textbox', { name: /Conflicting cost$/ }).fill('');
  await nextClick(page);
  await expectBudget(page, 80);
});

test('Dont Know excludes its numeric operand from store actions', async ({ page }) => {
  await openGlobalStoreStudy(page, 'test-global-store-operations');
  await fillCost(page, 'Unknown cost', 25);
  await page.getByRole('checkbox', { name: "I don't know", exact: true }).check();
  await nextClick(page);
  await expectBudget(page, 100);
});

test('global values stay isolated when moving between studies and returning to a participant', async ({ page }) => {
  await startBudgetStudy(page);
  await submitFormPurchase(page, 30);
  await expectBudget(page, 70);
  const originalUrl = page.url();
  await page.goto('/test-global-store-operations');
  await expect(page.getByRole('heading', { name: 'Primitive operations', exact: true })).toBeVisible();
  await nextClick(page);
  await expectBudget(page, 100);
  await page.goto(originalUrl);
  await expectBudget(page, 70);
  expect((await readGlobalStoreParticipant(page)).globalVariables.budget).toBe(70);
});

test('a committed dynamic purchase can skip directly to the end', async ({ page }) => {
  const config = {
    ...budgetStudy,
    sequence: {
      ...budgetStudy.sequence,
      components: [
        ...budgetStudy.sequence.components.slice(0, 6),
        {
          order: 'fixed',
          components: [budgetStudy.sequence.components[6]],
          skip: [{
            check: 'globalVariable', variable: 'budget', comparison: 'lessThan', value: 25, to: 'end',
          }],
        },
        ...budgetStudy.sequence.components.slice(7),
      ],
    },
  };
  await page.route('**/test-global-store/config.json', (route) => route.fulfill({ json: config }));
  await startBudgetStudy(page);
  await submitFormPurchase(page, 30);
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await fillCost(page, 'Confidence', 80);
  await nextClick(page);
  const frame = page.frameLocator('iframe');
  for (let i = 0; i < 2; i += 1) {
    await frame.getByRole('button', { name: 'Spend 10', exact: true }).click();
    await nextClick(page);
  }
  await submitFormPurchase(page, 5);
  await expect(page.getByRole('heading', { name: 'Dynamic purchase 1', exact: true })).toBeVisible();
  await fillCost(page, 'Dynamic cost', 5);
  await nextClick(page);
  await expect(page.getByText('Global store study complete.', { exact: true })).toBeVisible();
  const participant = await readGlobalStoreParticipant(page);
  expect(participant.globalVariables.budget).toBe(20);
  expect(Object.values(participant.answers).filter((answer: { trialOrder: string; endTime: number }) => answer.trialOrder.includes('_') && answer.endTime > 0)).toHaveLength(1);
});
