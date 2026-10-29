import { expect, Page } from '@playwright/test';
import { nextClick, resetClientStudyState } from './utils';

export async function openGlobalStoreStudy(page: Page, id = 'test-global-store') {
  await resetClientStudyState(page);
  await page.goto(`/${id}`);
}

export async function expectBudget(page: Page, budget: number) {
  await expect(page.getByText(`Entry budget: ${budget}`, { exact: true })).toBeVisible();
}

export async function fillCost(page: Page, label: string, value: number) {
  await page.getByRole('textbox', { name: new RegExp(`${label}$`) }).fill(String(value));
}

export async function submitFormPurchase(page: Page, above: number, below = 0, sidebar = 0) {
  await fillCost(page, 'Above cost', above);
  await fillCost(page, 'Below cost', below);
  await fillCost(page, 'Sidebar cost', sidebar);
  await nextClick(page);
}

export async function startBudgetStudy(page: Page) {
  await openGlobalStoreStudy(page);
  await expect(page.getByRole('heading', { name: 'Global store budget study', exact: true })).toBeVisible();
  await expectBudget(page, 100);
  await nextClick(page);
  await expect(page.getByRole('heading', { name: 'Form purchases', exact: true })).toBeVisible();
}

export async function readGlobalStoreParticipant(page: Page, study = 'test-global-store') {
  return page.evaluate(async (studyId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('revisit');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = database.transaction('keyvaluepairs', 'readonly');
      const objectStore = transaction.objectStore('keyvaluepairs');
      const keys = objectStore.getAllKeys();
      const values = objectStore.getAll();
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      return values.result.filter((value, index) => String(keys.result[index]).includes(studyId)
        && value && typeof value === 'object' && 'participantId' in value && 'answers' in value)
        .sort((a, b) => (b.globalStoreRevision ?? 0) - (a.globalStoreRevision ?? 0))[0] ?? null;
    } finally {
      database.close();
    }
  }, study);
}
