/* eslint-disable no-await-in-loop */
// Participant journeys must finish each action before advancing to the next trial.
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import budgetStudy from '../public/test-global-store/config.json' with { type: 'json' };
import type { StoredProvenance } from '../src/store/types';
import { nextClick, readStoredValue, resetClientStudyState } from './utils';
import {
  expectBudget, fillCost, readGlobalStoreParticipant, startBudgetStudy, submitFormPurchase,
} from './global-store.utils';

test('reload and unchanged Previous preserve the React stimulus, form and accepted budget', async ({ page }) => {
  await startBudgetStudy(page);
  await submitFormPurchase(page, 30);
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await fillCost(page, 'Confidence', 80);
  await nextClick(page);
  await expectBudget(page, 50);
  await page.reload();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectBudget(page, 70);
  await expect(page.getByRole('button', { name: 'Spend 20', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: /Confidence$/ })).toHaveValue('80');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByText('Tracked zoom: 2', { exact: true })).toBeVisible();
  await nextClick(page);
  await expectBudget(page, 50);
  await expect.poll(async () => (await readGlobalStoreParticipant(page))?.globalVariables?.budget).toBe(50);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByText('Tracked zoom: 2', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Tracked zoom: 2', { exact: true })).toBeVisible();
});

test('canceling an earlier edit preserves progress and confirmation starts a replacement path', async ({ page }) => {
  await startBudgetStudy(page);
  await submitFormPurchase(page, 30);
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await fillCost(page, 'Confidence', 80);
  await nextClick(page);
  await expectBudget(page, 50);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectBudget(page, 70);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectBudget(page, 100);
  await submitFormPurchase(page, 10);
  const dialog = page.getByRole('dialog', { name: 'Change earlier answers?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(async () => (await readGlobalStoreParticipant(page))?.globalVariables?.budget).toBe(50);
  await nextClick(page);
  await dialog.getByRole('button', { name: 'Change answers', exact: true }).click();
  await expectBudget(page, 90);
  await expect(page.getByText('Tracked entry budget: 90', { exact: true })).toBeVisible();
  await expect(page.getByText('Selected cost: none', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Confidence$/ })).toHaveValue('');
  await page.getByRole('button', { name: 'Spend 15', exact: true }).click();
  await fillCost(page, 'Confidence', 60);
  await nextClick(page);
  await expectBudget(page, 75);
  await page.reload();
  await expectBudget(page, 75);
  const participant = await readGlobalStoreParticipant(page);
  expect(participant.globalVariables.budget).toBe(75);
  expect(Object.values(participant.answers).filter((answer: { componentName: string }) => answer.componentName === 'reactPurchase')).toEqual([
    expect.objectContaining({ answer: expect.objectContaining({ selectedCost: 15, confidence: 60 }) }),
  ]);
});

test('revising an earlier answer reinitializes a visited unsubmitted React trial', async ({ page }) => {
  await startBudgetStudy(page);
  await submitFormPurchase(page, 30);
  await expect(page.getByText('Tracked entry budget: 70', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await fillCost(page, 'Confidence', 80);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await submitFormPurchase(page, 10);
  await expectBudget(page, 90);
  await expect(page.getByText('Tracked entry budget: 90', { exact: true })).toBeVisible();
  await expect(page.getByText('Tracked zoom: 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Selected cost: none', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Confidence$/ })).toHaveValue('');
});

test('HTML selection restores after reload and editing does not reload its document', async ({ page }) => {
  await startBudgetStudy(page);
  await submitFormPurchase(page, 30);
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await fillCost(page, 'Confidence', 80);
  await nextClick(page);
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Spend 10', exact: true }).click();
  await nextClick(page);
  await expectBudget(page, 40);
  await page.reload();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectBudget(page, 50);
  await expect(frame.getByRole('button', { name: 'Spend 10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await frame.getByRole('button', { name: 'Re-register store updater', exact: true }).click();
  await frame.getByRole('button', { name: 'Spend 5', exact: true }).click();
  await expect(frame.getByRole('button', { name: 'Spend 5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await nextClick(page);
  await expectBudget(page, 45);
});

test('HTML navigation to a page without an updater allows submission without the outgoing deduction', async ({ page }) => {
  await startBudgetStudy(page);
  await submitFormPurchase(page, 30);
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await fillCost(page, 'Confidence', 80);
  await nextClick(page);
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Spend 10', exact: true }).click();
  await frame.getByRole('link', { name: 'Continue without updater', exact: true }).click();
  await expect(frame.getByRole('heading', { name: 'Passive purchase page', exact: true })).toBeVisible();
  await nextClick(page);
  await expect(page.getByRole('heading', { name: 'Templated HTML purchase', exact: true })).toBeVisible();
  await expectBudget(page, 50);
});

test('changing the first decision regenerates dynamic trials and changes the active branch', async ({ page }) => {
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
  for (let i = 0; i < 2; i += 1) {
    await expect(page.getByRole('heading', { name: `Dynamic purchase ${i + 1}`, exact: true })).toBeVisible();
    await fillCost(page, 'Dynamic cost', 5);
    await nextClick(page);
  }
  await expectBudget(page, 15);
  await nextClick(page);
  await expect(page.getByRole('heading', { name: 'Low budget branch', exact: true })).toBeVisible();
  await nextClick(page);
  const previousPages: [string, number][] = [
    ['Low budget branch', 15], ['Budget decision', 15], ['Dynamic purchase 2', 20],
    ['Dynamic purchase 1', 25], ['Form purchases', 30], ['Templated HTML purchase', 40],
    ['HTML purchase', 50], ['React purchase', 70], ['Form purchases', 100],
  ];
  for (const [heading, budget] of previousPages) {
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expectBudget(page, budget);
  }
  await expect(page.getByRole('heading', { name: 'Form purchases', exact: true })).toBeVisible();
  await submitFormPurchase(page, 10);
  await page.getByRole('dialog', { name: 'Change earlier answers?' }).getByRole('button', { name: 'Change answers', exact: true }).click();
  await expectBudget(page, 90);
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await fillCost(page, 'Confidence', 80);
  await nextClick(page);
  for (let i = 0; i < 2; i += 1) {
    await frame.getByRole('button', { name: 'Spend 10', exact: true }).click();
    await nextClick(page);
  }
  await submitFormPurchase(page, 5);
  for (let i = 0; i < 2; i += 1) {
    await expect(page.getByRole('heading', { name: `Dynamic purchase ${i + 1}`, exact: true })).toBeVisible();
    await fillCost(page, 'Dynamic cost', 5);
    await nextClick(page);
  }
  await expectBudget(page, 35);
  await nextClick(page);
  await expect(page.getByRole('heading', { name: 'Funded branch', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Eligible participant note$/ })).toBeVisible();
  const participant = await readGlobalStoreParticipant(page);
  expect(Object.values(participant.answers).some((answer: { componentName: string; endTime: number }) => answer.componentName === 'lowBudget' && answer.endTime > 0)).toBe(false);
});

test('replay selects original and revised accepted answers without changing the participant', async ({ page }) => {
  await startBudgetStudy(page);
  await submitFormPurchase(page, 30);
  await page.getByRole('button', { name: 'Spend 20', exact: true }).click();
  await fillCost(page, 'Confidence', 80);
  await nextClick(page);
  await expectBudget(page, 50);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'React purchase', exact: true })).toBeVisible();
  await expectBudget(page, 70);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Form purchases', exact: true })).toBeVisible();
  await expectBudget(page, 100);
  await submitFormPurchase(page, 10);
  await page.getByRole('dialog', { name: 'Change earlier answers?' }).getByRole('button', { name: 'Change answers', exact: true }).click();
  await page.getByRole('button', { name: 'Spend 15', exact: true }).click();
  await fillCost(page, 'Confidence', 60);
  await nextClick(page);
  await expectBudget(page, 75);
  const participant = await readGlobalStoreParticipant(page);
  const participantUrl = page.url();
  await page.goto(`${participantUrl}?participantId=${participant.participantId}`);
  const history = page.getByRole('combobox', { name: 'Submission history', exact: true });
  const original = await history.locator('option').filter({ hasText: /reactPurchase.*retained history/ }).getAttribute('value');
  await history.selectOption(original!);
  await expect(page.getByText('Selected cost: 20', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Confidence$/ })).toHaveValue('80');
  await expectBudget(page, 70);
  const revised = await history.locator('option').filter({ hasText: /reactPurchase.*retained history/ }).getAttribute('value');
  await expect(page.getByText('Tracked entry budget: 70', { exact: true })).toBeVisible();
  await history.selectOption(revised!);
  await expect(page.getByText('Selected cost: 15', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Confidence$/ })).toHaveValue('60');
  await expectBudget(page, 90);
  expect((await readGlobalStoreParticipant(page)).globalStoreRevision).toBe(participant.globalStoreRevision);
  await expect(page.getByText('Tracked entry budget: 90', { exact: true })).toBeVisible();
  expect((await readGlobalStoreParticipant(page)).globalVariables.budget).toBe(75);
});

// Trrack's CommonJS entry works in Node; its ESM entry expects a browser bundler.
const { initializeTrrack, Registry } = createRequire(import.meta.url)('@trrack/core');

for (const protocol of ['legacy', 'unsupported-v1']) {
  test(`${protocol} HTML retains three independent visit graphs through completion`, async ({ page }) => {
    const trrack = initializeTrrack({ registry: Registry.create(), initialState: { cost: 0 } });
    const variants = [10, 20].map((cost) => {
      trrack.record({
        label: 'Select cost', state: { cost }, eventType: 'select', sideEffects: { do: [], undo: [] },
      });
      return structuredClone(trrack.graph.backend);
    });
    const config = {
      ...budgetStudy,
      components: {
        ...budgetStudy.components,
        review: {
          type: 'questionnaire', instruction: 'Review HTML purchase', previousButton: true, response: [],
        },
      },
      sequence: { order: 'fixed', components: ['introduction', 'htmlPurchase', 'review'] },
    };
    await page.route('**/test-global-store/config.json', (route) => route.fulfill({ json: config }));
    await page.route('**/test-global-store/assets/purchase.html*', (route) => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><script src="../../revisitUtilities/revisit-communicate.js"></script></head><body>
        <button data-cost="10">Spend 10</button><button data-cost="20">Spend 20</button>
        <output id="selected">none</output><script>
        // Valid Trrack graphs, with independent IDs for each document load.
        let serialized = ${JSON.stringify(JSON.stringify(variants))};
        const originals = JSON.parse(serialized);
        Object.keys(originals[1].nodes).forEach((id) => { serialized = serialized.split(id).join(crypto.randomUUID()); });
        const graphs = JSON.parse(serialized);
        let selectedCost;
        ${protocol === 'unsupported-v1' ? 'Revisit.registerGlobalStoreUpdater(({ store }) => ({ budget: store.budget - selectedCost }));' : ''}
        document.querySelectorAll('button').forEach((button, index) => button.onclick = () => {
          selectedCost = Number(button.dataset.cost);
          document.querySelector('#selected').textContent = selectedCost;
          Revisit.postProvenance(graphs[index]);
          Revisit.postAnswers({ selectedCost });
        });
        </script></body></html>`,
    }));
    await resetClientStudyState(page);
    await page.goto('/test-global-store');
    await nextClick(page);
    const savedGraphs: StoredProvenance['stimulus'][] = [];
    for (const cost of [10, 20, 10]) {
      const frame = page.frameLocator('iframe');
      await frame.getByRole('button', { name: `Spend ${cost}`, exact: true }).click();
      await expect(frame.locator('#selected')).toHaveText(String(cost));
      await nextClick(page);
      await expect(page.getByText('Review HTML purchase', { exact: true })).toBeVisible();
      const participant = await readGlobalStoreParticipant(page);
      const key = `dev-test-global-store/provenance/${participant.participantId}_htmlPurchase_1`;
      await expect.poll(async () => (await readStoredValue<StoredProvenance>(page, key))?.stimulus?.current).not.toBe(savedGraphs.at(-1)?.current);
      const saved = (await readStoredValue<StoredProvenance>(page, key))!.stimulus!;
      savedGraphs.push(saved);
      savedGraphs.forEach((visit, index) => {
        const replay = initializeTrrack({ registry: Registry.create(), initialState: {} });
        replay.importObject({ ...saved, current: visit!.current });
        expect(replay.getState()).toEqual({ cost: [10, 20, 10][index] });
      });
      expect(saved.root).toBe(savedGraphs[0]!.root);
      if (savedGraphs.length < 3) {
        await page.reload();
        await page.getByRole('button', { name: 'Previous', exact: true }).click();
      }
    }
    await nextClick(page);
    await expect(page.getByText('Global store study complete.', { exact: true })).toBeVisible();
    const participant = await readGlobalStoreParticipant(page);
    expect(participant.globalVariables.budget).toBe(protocol === 'legacy' ? 100 : 90);
  });
}
