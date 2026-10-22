/* eslint-disable no-await-in-loop */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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

  test('resumes an unfinished pre-migration participant and preserves the earlier answer', async ({ page }) => {
    const participantId = process.env.PW_SUPABASE_RESUME_PARTICIPANT;
    test.skip(!participantId, 'Set PW_SUPABASE_RESUME_PARTICIPANT for the unfinished participant rehearsal');
    const seed = process.env.PW_SUPABASE_SEED_RESUME === '1';
    const previous = seed ? null : await readParticipant(participantId!);
    const earlierAnswer = Object.values(previous?.answers ?? {})
      .find((answer) => answer.componentName.startsWith('color-trial-') && Object.values(answer.answer).includes('A'));
    if (!seed) {
      expect(previous?.participantId).toBe(participantId);
      expect(earlierAnswer).toBeTruthy();
      expect(colorAnswers(previous).flatMap((answer) => Object.values(answer))).not.toContain('B');
    }

    await selectParticipant(page, participantId!);
    await page.goto('/demo-condition?condition=color');
    await nextClick(page);
    const question = page.getByText(/Which color is the (lightest|darkest)\?/);
    await expect(question).toBeVisible();
    const firstQuestion = await question.textContent();
    const response = page.getByPlaceholder('Select an option');
    if (seed) {
      await response.click();
      await page.getByRole('option', { name: 'A', exact: true }).click();
    } else {
      await expect(response).toHaveValue('A');
    }
    await nextClick(page);
    await expect(question).toBeVisible();
    await expect(question).not.toHaveText(firstQuestion!);
    await expect(response).toHaveValue('');
    await expect.poll(async () => colorAnswers(await readParticipant(participantId!))
      .flatMap((answer) => Object.values(answer))).toContain('A');

    if (!seed) {
      await response.click();
      await page.getByRole('option', { name: 'B', exact: true }).click();
      await nextClick(page);
      await waitForStudyEndMessage(page);
      await expect.poll(async () => colorAnswers(await readParticipant(participantId!))
        .flatMap((answer) => Object.values(answer))).toEqual(expect.arrayContaining(['A', 'B']));
      const current = await readParticipant(participantId!);
      expect(Object.values(current!.answers).find((answer) => answer.componentName === earlierAnswer!.componentName)?.answer)
        .toEqual(earlierAnswer!.answer);
    }
  });

  test('authenticates a retained Designer account and exports retained answers through the UI', async ({ page }) => {
    const email = process.env.PW_SUPABASE_DESIGNER_EMAIL;
    const password = process.env.PW_SUPABASE_DESIGNER_PASSWORD;
    const participantId = process.env.PW_SUPABASE_EXISTING_PARTICIPANT;
    test.skip(!email || !password || !participantId, 'Set Designer credentials and the retained participant ID');

    await page.goto('/analysis/stats/demo-condition/manage');
    await expect(page.getByRole('alert', { name: 'Unauthorized Access' })).toBeVisible();

    // The app's sign-in button uses external GitHub OAuth. Use a real Auth password
    // session here to exercise account retention, authorization and exports locally.
    const url = process.env.VITE_SUPABASE_URL!;
    const client = createClient(url, process.env.VITE_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email: email!, password: password! });
    expect(error).toBeNull();
    expect(data.user?.email).toBe(email);
    const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
    await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
      key: storageKey, session: data.session,
    });
    await page.goto('/analysis/stats/demo-condition/table');
    await expect(page.getByRole('columnheader', { name: /^ID Sort by ID/ })).toBeVisible();

    const jsonButton = page.locator('button').filter({ has: page.locator('svg.tabler-icon-database-export') });
    await expect(jsonButton).toBeEnabled();
    const jsonDownload = page.waitForEvent('download');
    await jsonButton.click();
    const downloaded = await jsonDownload;
    expect(await downloaded.failure()).toBeNull();
    const participants = JSON.parse(await readFile((await downloaded.path())!, 'utf8')) as ParticipantData[];
    const retained = participants.find((participant) => participant.participantId === participantId);
    expect(retained).toBeTruthy();
    expect(retained?.answers).toEqual((await readParticipant(participantId!))?.answers);

    const csvButton = page.locator('button').filter({ has: page.locator('svg.tabler-icon-table-export') });
    await csvButton.click();
    const exporter = page.getByRole('dialog', { name: 'Tidy CSV Exporter' });
    await expect(exporter).toBeVisible();
    const csvDownload = page.waitForEvent('download');
    await exporter.getByRole('button', { name: 'Download', exact: true }).click();
    const csv = await csvDownload;
    expect(await csv.failure()).toBeNull();
    expect(await readFile((await csv.path())!, 'utf8')).toContain(participantId!);
  });

  test('supports binary files, overwrites and signed downloads with a participant session', async ({ request }) => {
    const client = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: authError } = await client.auth.signInAnonymously();
    expect(authError).toBeNull();
    const bucket = client.storage.from('revisit');
    const path = `${studyId}/recording checks/${randomUUID()}.webm`;
    const original = Uint8Array.from([0, 1, 127, 128, 255]);
    const replacement = Uint8Array.from([255, 128, 0, 42]);
    try {
      const { error: uploadError } = await bucket.upload(path, original, { contentType: 'video/webm' });
      expect(uploadError).toBeNull();
      const { data: downloaded, error: downloadError } = await bucket.download(path);
      expect(downloadError).toBeNull();
      expect(new Uint8Array(await downloaded!.arrayBuffer())).toEqual(original);

      const { error: overwriteError } = await bucket.upload(path, replacement, { upsert: true, contentType: 'video/webm' });
      expect(overwriteError).toBeNull();
      const { data: signed, error: signError } = await bucket.createSignedUrl(path, 60);
      expect(signError).toBeNull();
      const response = await request.get(signed!.signedUrl);
      expect(response.ok()).toBeTruthy();
      expect(response.headers()['content-type']).toContain('video/webm');
      expect(new Uint8Array(await response.body())).toEqual(replacement);
    } finally {
      const { error } = await bucket.remove([path]);
      expect(error).toBeNull();
    }
    const { error: removedError } = await bucket.download(path);
    expect(removedError).not.toBeNull();
  });
});
