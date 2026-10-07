/* eslint-disable no-await-in-loop */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, Page, test } from '@playwright/test';
import { ParticipantData } from '../src/storage/types';
import { nextClick, waitForStudyEndMessage } from './utils';

// Run against an isolated local stack, with Vite configured to use the same Supabase URL.
// Keep the participants so this suite can verify them again after a migration/restart.
const enabled = process.env.PW_SUPABASE_LIVE === '1';
const studyId = 'dev-demo-condition';

test.describe('Live self-hosted Supabase', () => {
  test.skip(!enabled, 'Set PW_SUPABASE_LIVE=1 for the local Supabase migration rehearsal');

  function storageClient() {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.PW_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Live Supabase requires VITE_SUPABASE_URL and PW_SUPABASE_SERVICE_ROLE_KEY');
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async function readParticipant(participantId: string) {
    const { data, error } = await storageClient().storage.from('revisit')
      .download(`${studyId}/participants/${participantId}_participantData`);
    if (error || !data) return null;
    return JSON.parse(await data.text()) as ParticipantData;
  }

  function colorAnswers(participant: ParticipantData | null) {
    return Object.values(participant?.answers ?? {})
      .filter((answer) => answer.componentName.startsWith('color-trial-'))
      .map((answer) => answer.answer);
  }

  async function selectParticipant(page: Page, participantId: string) {
    await page.goto('/');
    await page.evaluate(({ id, study }) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('revisit-supabase');
      request.onupgradeneeded = () => request.result.createObjectStore('keyvaluepairs');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('keyvaluepairs', 'readwrite');
        transaction.objectStore('keyvaluepairs').put(id, `${study}/currentParticipantId`);
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
    }), { id: participantId, study: studyId });
  }

  test('persists real participant answers and resumes from Supabase in a fresh browser context', async ({ page, browser }) => {
    const startedAt = Date.now();
    const participantId = process.env.PW_SUPABASE_PARTICIPANT_ID || randomUUID();
    const studyPath = '/demo-condition?condition=color';
    await selectParticipant(page, participantId);
    await page.goto(studyPath);
    await expect(page.getByText(/url query parameter.*condition/i)).toBeVisible();
    await nextClick(page);

    for (let trial = 0; trial < 2; trial += 1) {
      await expect(page.getByText(/Which color is the (lightest|darkest)\?/)).toBeVisible();
      await page.getByPlaceholder('Select an option').click();
      await page.getByRole('option', { name: 'A', exact: true }).click();
      await nextClick(page);
    }
    await waitForStudyEndMessage(page);

    await expect.poll(async () => colorAnswers(await readParticipant(participantId)), { timeout: 15000 })
      .toEqual(expect.arrayContaining([
        { 'color-trial-1-response': 'A' },
        { 'color-trial-2-response': 'A' },
      ]));
    const participant = await readParticipant(participantId);
    expect(participant?.participantId).toBe(participantId);
    expect(participant?.participantConfigHash).toBeTruthy();
    const { data: assignments, error } = await storageClient().from('revisit').select('data')
      .eq('studyId', studyId)
      .eq('docId', `sequenceAssignment_${participantId}`);
    expect(error).toBeNull();
    expect(assignments?.[0]?.data.completed).toBeGreaterThanOrEqual(startedAt);

    // Force the reload to retrieve the participant from the backend, not localforage.
    const completedUrl = page.url();
    const freshContext = await browser.newContext({ baseURL: new URL(completedUrl).origin });
    try {
      const freshPage = await freshContext.newPage();
      await selectParticipant(freshPage, participantId);
      await freshPage.goto(completedUrl);
      await waitForStudyEndMessage(freshPage);
    } finally {
      await freshContext.close();
    }
    expect(colorAnswers(await readParticipant(participantId))).toEqual(colorAnswers(participant));
  });

  test('reads a participant retained from the old stack after migration', async ({ page }) => {
    const participantId = process.env.PW_SUPABASE_EXISTING_PARTICIPANT;
    test.skip(!participantId, 'Set PW_SUPABASE_EXISTING_PARTICIPANT to the pre-migration participant ID');
    const participant = await readParticipant(participantId!);
    expect(participant?.participantId).toBe(participantId);
    expect(colorAnswers(participant)).toEqual(expect.arrayContaining([
      { 'color-trial-1-response': 'A' },
      { 'color-trial-2-response': 'A' },
    ]));
    await selectParticipant(page, participantId!);
    await page.goto('/demo-condition?condition=color');
    await nextClick(page);
    await expect(page.getByText(/Which color is the (lightest|darkest)\?/)).toBeVisible();
    await expect(page.getByPlaceholder('Select an option')).toHaveValue('A');
    expect(colorAnswers(await readParticipant(participantId!))).toEqual(colorAnswers(participant));
  });
});
