/* eslint-disable no-await-in-loop */
import { expect, Page } from '@playwright/test';

const UPLOADING_MESSAGE = 'Please wait while your answers are uploaded.';
const DEFAULT_COMPLETED_MESSAGE = 'Thank you for completing the study. You may close this window now.';
const PROLIFIC_COMPLETED_MESSAGE = /Thank you for completing the study\.\s*You may click this link and return to Prolific/i;

type StudyTitleMatcher = string | RegExp;

export async function readStoredComponentTiming(page: Page, componentName: string) {
  return page.evaluate(async (name) => new Promise<{ participantId: string; startTime: number; endTime: number } | null>((resolve) => {
    const request = indexedDB.open('revisit');
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('keyvaluepairs', 'readonly');
      const store = transaction.objectStore('keyvaluepairs');
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      keysRequest.onerror = () => resolve(null);
      valuesRequest.onerror = () => resolve(null);
      transaction.oncomplete = () => {
        const participantKeys = keysRequest.result
          .map((key, index) => ({ key: String(key), value: valuesRequest.result[index] }))
          .filter(({ key }) => key.includes('/participants/') && key.endsWith('_participantData'));
        for (const { value } of participantKeys) {
          const participant = value as { participantId?: string; answers?: Record<string, { componentName?: string; startTime?: number; endTime?: number }> } | null;
          const answer = Object.values(participant?.answers ?? {}).find((candidate) => candidate.componentName === name);
          if (participant?.participantId && typeof answer?.startTime === 'number' && typeof answer.endTime === 'number') {
            database.close();
            resolve({
              participantId: participant.participantId,
              startTime: answer.startTime,
              endTime: answer.endTime,
            });
            return;
          }
        }
        database.close();
        resolve(null);
      };
    };
  }), componentName);
}

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
  const main = page.getByRole('main');
  const initialUrl = page.url();
  const initialComponentId = await main.locator('[id]').first().getAttribute('id');
  const initialMainText = await main.innerText();
  const deadline = Date.now() + timeout;
  let lastError: unknown;

  const hasAdvanced = async () => (
    page.url() !== initialUrl
    || await main.locator('[id]').first().getAttribute('id') !== initialComponentId
    || await main.innerText() !== initialMainText
  );

  const waitForNextStep = async (remaining: number) => {
    await expect.poll(hasAdvanced, {
      timeout: remaining,
      intervals: [100, 250, 500, 1000],
    }).toBe(true);
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }

    await expect(nextButton).toBeVisible({ timeout: remaining });
    await expect(nextButton).toBeEnabled({ timeout: remaining });
    try {
      await nextButton.click({ timeout: Math.min(2000, remaining), noWaitAfter: true });
      await waitForNextStep(deadline - Date.now());
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransitionRace = message.includes('detached from the DOM') || message.includes('element is not enabled');
      if (!isTransitionRace) {
        throw error;
      }

      // A transition race is only successful once the study has navigated to
      // the next step. Button state alone does not prove that the click took.
      const remainingAfterRace = deadline - Date.now();
      if (remainingAfterRace > 0) {
        try {
          await waitForNextStep(remainingAfterRace);
          return;
        } catch {
          // The click did not advance the study; retry while the deadline
          // remains so a transient render race can recover.
        }
      }

      if (Date.now() >= deadline) {
        throw error;
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
  const bodyContains = async (message: string | RegExp) => {
    const body = await page.locator('body').innerText().catch(() => '');
    return typeof message === 'string' ? body.includes(message) : message.test(body);
  };
  const isDefaultCompleted = async () => (
    await defaultCompleted.isVisible().catch(() => false)
    || await bodyContains(DEFAULT_COMPLETED_MESSAGE)
  );
  const isProlificCompleted = async () => (
    await prolificCompleted.isVisible().catch(() => false)
    || await bodyContains(PROLIFIC_COMPLETED_MESSAGE)
  );

  await expect.poll(async () => (
    (await isDefaultCompleted())
    || (await isProlificCompleted())
    || (await uploading.isVisible())
  ), { timeout }).toBe(true);

  if (!(await isDefaultCompleted()) && !(await isProlificCompleted())) {
    await expect(defaultCompleted.or(prolificCompleted)).toBeVisible({ timeout });
  }
}

export async function readStoredValue<T>(page: Page, key: string): Promise<T | null> {
  return page.evaluate(async (storageKey) => new Promise<T | null>((resolve) => {
    const openRequest = indexedDB.open('revisit');

    openRequest.onerror = () => resolve(null);
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      if (!database.objectStoreNames.contains('keyvaluepairs')) {
        database.close();
        resolve(null);
        return;
      }

      const transaction = database.transaction('keyvaluepairs', 'readonly');
      const getRequest = transaction.objectStore('keyvaluepairs').get(storageKey);
      getRequest.onerror = () => resolve(null);
      getRequest.onsuccess = () => resolve((getRequest.result as T | undefined) ?? null);
      transaction.oncomplete = () => database.close();
    };
  }), key);
}

export async function readParticipantRecording(
  page: Page,
  studyId: string,
  identifier: string,
) {
  const assignments = await readStoredValue<Record<string, unknown>>(
    page,
    `dev-${studyId}/sequenceAssignment`,
  );
  const participantId = Object.keys(assignments ?? {})[0];
  if (!participantId) {
    return null;
  }

  const participant = await readStoredValue<{
    answers?: Record<string, {
      answer?: Record<string, unknown>;
      startTime?: number;
      endTime?: number;
    }>;
  }>(page, `dev-${studyId}/participants/${participantId}_participantData`);
  const answer = participant?.answers?.[identifier];
  if (
    typeof answer?.startTime !== 'number'
    || typeof answer.endTime !== 'number'
    || answer.startTime <= 0
    || answer.endTime < answer.startTime
  ) {
    return null;
  }

  return {
    answer: answer.answer ?? {},
    endTime: answer.endTime,
    participantId,
    startTime: answer.startTime,
  };
}

export async function seekReplay(
  page: Page,
  startTime: number,
  endTime: number,
  targetTime: number,
) {
  const timer = page.getByTestId('replay-timer');
  await expect(timer).toBeVisible();
  const timerBounds = await timer.boundingBox();
  if (!timerBounds) {
    throw new Error('Analysis replay timer has no bounds');
  }

  const duration = endTime - startTime;
  const targetOffset = duration === 0
    ? 0
    : Math.min(duration, Math.max(0, targetTime - startTime));
  const fraction = duration === 0 ? 0 : targetOffset / duration;
  const x = 20 + Math.min(1, Math.max(0, fraction)) * (timerBounds.width - 40);
  await timer.click({ position: { x, y: timerBounds.height / 2 } });

  try {
    await expect.poll(async () => {
      const replayTime = Number(await timer.getAttribute('data-replay-time'));
      return Number.isFinite(replayTime) && Math.abs(replayTime - (targetOffset / 1000)) <= 0.25;
    }, { timeout: 15000 }).toBe(true);
  } catch (error) {
    const replayTime = await timer.getAttribute('data-replay-time');
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error([
      `Replay timer did not settle near ${targetOffset / 1000}s after seeking.`,
      `Actual replay time: ${replayTime ?? '<none>'}s`,
      reason,
    ].join('\n'));
  }
}
