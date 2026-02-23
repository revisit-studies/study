import { test, expect, Page } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
} from './utils';

async function hasAnswerPersistedInIndexedDb(page: Page, answerIdentifier: string) {
  return page.evaluate(async (identifier) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('revisit');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    try {
      const tx = db.transaction('keyvaluepairs', 'readonly');
      const store = tx.objectStore('keyvaluepairs');
      const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const participantDataKeys = keys
        .map((key) => String(key))
        .filter((key) => key.includes('/participants/') && key.endsWith('_participantData'));

      for (const key of participantDataKeys) {
        // eslint-disable-next-line no-await-in-loop
        const participantData = await new Promise<Record<string, unknown> | null>((resolve, reject) => {
          const request = store.get(key);
          request.onsuccess = () => resolve((request.result || null) as Record<string, unknown> | null);
          request.onerror = () => reject(request.error);
        });

        const answers = participantData?.answers as Record<string, unknown> | undefined;
        if (answers && Object.hasOwn(answers, identifier)) {
          return true;
        }
      }

      return false;
    } finally {
      db.close();
    }
  }, answerIdentifier);
}

function getStudyRouteSegments(urlString: string) {
  const segments = new URL(urlString).pathname.split('/').filter(Boolean);

  if (segments.length < 3) {
    return null;
  }

  return {
    studySegment: segments[0],
    stepSegment: segments[1],
    funcIndexSegment: segments[2],
  };
}

test('syncs dynamic child route index from currentTrial query', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Dynamic Blocks');

  await expect(page.getByText(/sample study.*dynamic blocks/i)).toBeVisible();
  await nextClick(page);

  await expect(page.getByRole('heading', { name: 'Dynamic Blocks' })).toBeVisible({ timeout: 15000 });

  await expect.poll(() => getStudyRouteSegments(page.url())?.funcIndexSegment, { timeout: 10000 }).toBeTruthy();
  const firstRoute = getStudyRouteSegments(page.url());
  if (!firstRoute) {
    throw new Error(`Expected dynamic route with func index, got: ${page.url()}`);
  }
  const { studySegment, stepSegment, funcIndexSegment: firstFuncIndexSegment } = firstRoute;

  await page.getByRole('radio', { name: 'Right' }).click();
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await nextClick(page);

  await expect(page.getByRole('heading', { name: 'Dynamic Blocks' })).toBeVisible({ timeout: 15000 });

  await expect.poll(() => getStudyRouteSegments(page.url())?.funcIndexSegment, { timeout: 10000 }).toBeTruthy();
  const secondRoute = getStudyRouteSegments(page.url());
  if (!secondRoute) {
    throw new Error(`Expected dynamic route with func index, got: ${page.url()}`);
  }
  const { funcIndexSegment: secondFuncIndexSegment } = secondRoute;

  await page.getByRole('radio', { name: 'Right' }).click();
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await nextClick(page);

  await expect(page.getByRole('heading', { name: 'Dynamic Blocks' })).toBeVisible({ timeout: 15000 });

  await expect.poll(async () => hasAnswerPersistedInIndexedDb(page, 'dynamicBlock_1_HSLColorCodes_1'), { timeout: 10000 }).toBe(true);

  const wrongChildUrl = new URL(page.url());
  wrongChildUrl.pathname = `/${studySegment}/${stepSegment}/${firstFuncIndexSegment}`;
  wrongChildUrl.searchParams.set('currentTrial', 'dynamicBlock_1_HSLColorCodes_1');
  await page.goto(wrongChildUrl.toString());

  await expect.poll(() => new URL(page.url()).pathname).toBe(`/${studySegment}/${stepSegment}/${secondFuncIndexSegment}`);
});

test('removes dynamic child route index for non-dynamic currentTrial query', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Dynamic Blocks');

  await expect(page.getByText(/sample study.*dynamic blocks/i)).toBeVisible();

  const introPath = new URL(page.url()).pathname;
  const introSegments = introPath.split('/').filter(Boolean);
  if (introSegments.length < 2) {
    throw new Error(`Expected non-dynamic intro route, got: ${page.url()}`);
  }
  const [studySegment, introStepSegment] = introSegments;

  await nextClick(page);
  await expect(page.getByRole('heading', { name: 'Dynamic Blocks' })).toBeVisible({ timeout: 15000 });

  await expect.poll(() => getStudyRouteSegments(page.url())?.funcIndexSegment, { timeout: 10000 }).toBeTruthy();
  const dynamicRoute = getStudyRouteSegments(page.url());
  if (!dynamicRoute) {
    throw new Error(`Expected dynamic route with func index, got: ${page.url()}`);
  }
  const { stepSegment: dynamicStepSegment, funcIndexSegment: dynamicFuncIndexSegment } = dynamicRoute;

  const wrongChildUrl = new URL(page.url());
  wrongChildUrl.pathname = `/${studySegment}/${dynamicStepSegment}/${dynamicFuncIndexSegment}`;
  wrongChildUrl.searchParams.set('currentTrial', 'introduction_0');
  await page.goto(wrongChildUrl.toString());

  await expect.poll(() => new URL(page.url()).pathname).toBe(`/${studySegment}/${introStepSegment}`);
  await expect(page.getByText(/sample study.*dynamic blocks/i)).toBeVisible();
});
