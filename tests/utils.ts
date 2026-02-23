/* eslint-disable no-await-in-loop */
import { expect, Page } from '@playwright/test';

const UPLOADING_MESSAGE = 'Please wait while your answers are uploaded.';
const DEFAULT_COMPLETED_MESSAGE = 'Thank you for completing the study. You may close this window now.';
const PROLIFIC_COMPLETED_MESSAGE = /Thank you for completing the study\.\s*You may click this link and return to Prolific/i;

type StudyTitleMatcher = string | RegExp;

export async function resetClientStudyState(page: Page) {
  await page.goto('/');

  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    const deleteDatabase = async (name: string) => new Promise<void>((resolve) => {
      try {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      } catch {
        resolve();
      }
    });

    const databaseNames = new Set<string>(['revisit']);
    const idbWithDatabases = indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string }>>;
    };

    if (typeof idbWithDatabases.databases === 'function') {
      try {
        const databases = await idbWithDatabases.databases();
        databases.forEach((database) => {
          if (database?.name) {
            databaseNames.add(database.name);
          }
        });
      } catch {
        // No-op. Safari/WebKit may not support indexedDB.databases().
      }
    }

    await Promise.all(Array.from(databaseNames).map(deleteDatabase));
  });
}

export async function openStudyFromLanding(
  page: Page,
  sectionLabel: string,
  cardTitle: StudyTitleMatcher | StudyTitleMatcher[],
) {
  await page.goto('/');

  const matchers = Array.isArray(cardTitle) ? cardTitle : [cardTitle];
  const section = page.getByLabel(sectionLabel);
  await expect(section).toBeVisible();

  for (const matcher of matchers) {
    const studyCard = section.locator('div').filter({ hasText: matcher }).first();
    if (await studyCard.isVisible().catch(() => false)) {
      await studyCard.getByText('Go to Study').click();
      return;
    }
  }

  throw new Error(`Could not find study card in "${sectionLabel}" for matchers: ${matchers.map(String).join(', ')}`);
}

export async function nextClick(page: Page, timeout = 10000) {
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  const deadline = Date.now() + timeout;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }

    await expect(nextButton).toBeVisible({ timeout: remaining });
    await expect(nextButton).toBeEnabled({ timeout: remaining });
    try {
      await nextButton.click({ timeout: Math.min(2000, remaining), noWaitAfter: true });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransitionRace = message.includes('detached from the DOM') || message.includes('element is not enabled');
      if (!isTransitionRace) {
        throw error;
      }

      // If the button is no longer interactable after the click attempt, most
      // often the transition has already started and we should not fail here.
      const stillVisible = await nextButton.isVisible().catch(() => false);
      const stillEnabled = stillVisible && await nextButton.isEnabled().catch(() => false);
      if (!stillEnabled) {
        return;
      }

      lastError = error;
      await page.waitForTimeout(100);
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Timed out clicking Next button');
}

export async function waitForStudyEndMessage(page: Page, timeout = 30000) {
  const uploading = page.getByText(UPLOADING_MESSAGE, { exact: true });
  const defaultCompleted = page.getByText(DEFAULT_COMPLETED_MESSAGE, { exact: true });
  const prolificCompleted = page.getByText(PROLIFIC_COMPLETED_MESSAGE);

  await expect.poll(async () => (
    (await defaultCompleted.isVisible())
    || (await prolificCompleted.isVisible())
    || (await uploading.isVisible())
  ), { timeout }).toBe(true);

  if (!(await defaultCompleted.isVisible()) && !(await prolificCompleted.isVisible())) {
    await expect(defaultCompleted.or(prolificCompleted)).toBeVisible({ timeout });
  }
}
