/* eslint-disable no-await-in-loop */
import { expect, test, type Page } from '@playwright/test';
import reactConfig from '../public/demo-react-trrack/config.json' with { type: 'json' };
import htmlConfig from '../public/demo-html-trrack/config.json' with { type: 'json' };
import svelteConfig from '../public/demo-svelte-trrack/config.json' with { type: 'json' };
import vegaConfig from '../public/demo-vega/config.json' with { type: 'json' };
import {
  nextClick, readParticipantRecording, readStoredValue, resetClientStudyState, seekReplay,
} from './utils';

type Graph = {
  nodes: Record<string, { children: string[]; [key: string]: unknown }>;
  traversalEvents: Array<{ createdOn: number }>;
};
type TrialAnswer = { startTime: number; endTime: number; windowEvents: unknown[] };

async function savedTrial(page: Page, studyId: string, identifier: string) {
  const recording = await readParticipantRecording(page, studyId, identifier);
  if (!recording) return null;
  const provenance = await readStoredValue<{ stimulus: Graph; aboveStimulus?: Graph; belowStimulus?: Graph; sidebar?: Graph }>(page, `dev-${studyId}/provenance/${recording.participantId}_${identifier}`);
  const participant = await readStoredValue<{ answers: Record<string, TrialAnswer> }>(page, `dev-${studyId}/participants/${recording.participantId}_participantData`);
  if (!provenance?.stimulus || !participant?.answers[identifier]) return null;
  return {
    ...recording, graph: provenance.stimulus, provenance, trial: participant.answers[identifier],
  };
}

const demos = [
  {
    id: 'demo-react-trrack', config: reactConfig, trial: 'trial-red-blue', identifier: 'trial-red-blue_1', kind: 'react',
  },
  {
    id: 'demo-html-trrack', config: htmlConfig, trial: 'countDots', identifier: 'countDots_1', kind: 'website',
  },
  {
    id: 'demo-svelte-trrack', config: svelteConfig, trial: 'countDots', identifier: 'countDots_1', kind: 'website',
  },
  {
    id: 'demo-vega', config: vegaConfig, trial: 'vegademo2', identifier: 'vegademo2_1', kind: 'vega',
  },
] as const;

for (const demo of demos) {
  test(`${demo.id} resumes the saved graph and appends a second visit`, async ({ page }) => {
    // Keep the existing stimuli and add a return path without changing the demos.
    const config = {
      ...demo.config,
      uiConfig: { ...demo.config.uiConfig, windowEventDebounceTime: 0 },
      components: {
        ...demo.config.components,
        review: {
          type: 'questionnaire', instruction: 'Review your response', previousButton: true, response: [],
        },
      },
      sequence: { order: 'fixed', components: ['introduction', demo.trial, 'review'] },
    };
    await page.route(`**/${demo.id}/config.json`, (route) => route.fulfill({ json: config }));
    await resetClientStudyState(page);
    await page.goto(`/${demo.id}`);
    await nextClick(page);
    const trialPath = new URL(page.url()).pathname;
    const frame = page.frameLocator('#root iframe');
    const input = page.locator('main').getByRole('textbox');
    const selects = page.locator('main select');
    const expectState = async (secondVisit: boolean) => {
      if (demo.kind === 'react') await expect(input).toHaveValue(secondVisit ? 'PINK' : 'BLUE');
      if (demo.kind === 'website') await expect(frame.locator('circle')).toHaveCount(secondVisit ? 3 : 2);
      if (demo.kind === 'vega') await expect(selects.nth(0)).toHaveValue(secondVisit ? 'Worldwide Gross' : 'US Gross');
    };
    const stateMatches = async (secondVisit: boolean) => {
      if (demo.kind === 'react') return await input.inputValue() === (secondVisit ? 'PINK' : 'BLUE');
      if (demo.kind === 'website') return await frame.locator('circle').count() === (secondVisit ? 3 : 2);
      return await selects.nth(0).inputValue() === (secondVisit ? 'Worldwide Gross' : 'US Gross');
    };
    if (demo.kind === 'react') await input.fill('BLUE');
    if (demo.kind === 'website') {
      await expect(frame.locator('circle')).toHaveCount(1);
      await frame.getByRole('button', { name: 'Add', exact: true }).click();
    }
    if (demo.kind === 'vega') {
      await expect(selects).toHaveCount(2);
      await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
      await selects.nth(0).selectOption({ label: 'US Gross' });
      await page.getByRole('slider').first().press('ArrowRight');
      const chart = page.locator('main canvas.marks').first();
      const bounds = await chart.boundingBox();
      if (!bounds) throw new Error('Vega chart has no bounds');
      const selected = page.locator('[class*="mantine-InputWrapper-root"]').filter({ hasText: 'You selected:' }).locator('li');
      for (let y = 20; y < bounds.height && !(await selected.count()); y += 20) {
        for (let x = 20; x < bounds.width && !(await selected.count()); x += 20) {
          await chart.click({ position: { x, y }, force: true });
        }
      }
      await expect(selected.first()).toBeVisible();
    }
    await expectState(false);
    await page.mouse.move(120, 140);
    await nextClick(page);
    await expect(page.getByText('Review your response')).toBeVisible();
    await expect.poll(async () => Boolean(await savedTrial(page, demo.id, demo.identifier))).toBe(true);
    const first = (await savedTrial(page, demo.id, demo.identifier))!;
    expect(Object.keys(first.graph.nodes).length).toBeGreaterThan(1);
    expect(first.trial.windowEvents.length).toBeGreaterThan(0);

    // Reload drops the live graph, forcing restoration from storage.
    await page.reload();
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expectState(false);
    await nextClick(page);
    await expect(page.getByText('Review your response')).toBeVisible();
    await expect.poll(async () => (await savedTrial(page, demo.id, demo.identifier))?.trial.endTime ?? 0, { timeout: 15000 }).toBeGreaterThan(first.trial.endTime);
    const unchanged = (await savedTrial(page, demo.id, demo.identifier))!;
    expect(unchanged.provenance).toEqual(first.provenance);
    expect(unchanged.trial.startTime).toEqual(first.trial.startTime);
    expect(unchanged.trial.windowEvents.slice(0, first.trial.windowEvents.length)).toEqual(first.trial.windowEvents);

    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expectState(false);
    await page.waitForTimeout(150);
    if (demo.kind === 'react') await input.fill('PINK');
    if (demo.kind === 'website') await frame.getByRole('button', { name: 'Add', exact: true }).click();
    if (demo.kind === 'vega') await selects.nth(0).selectOption({ label: 'Worldwide Gross' });
    await expectState(true);
    await page.waitForTimeout(150);
    await nextClick(page);
    await expect(page.getByText('Review your response')).toBeVisible();
    await expect.poll(async () => Object.keys((await savedTrial(page, demo.id, demo.identifier))?.graph.nodes ?? {}).length).toBeGreaterThan(Object.keys(first.graph.nodes).length);
    await expect.poll(async () => (await savedTrial(page, demo.id, demo.identifier))?.trial.endTime ?? 0, { timeout: 15000 }).toBeGreaterThan(unchanged.trial.endTime);
    const resumed = (await savedTrial(page, demo.id, demo.identifier))!;
    for (const [id, node] of Object.entries(first.graph.nodes)) {
      const { children, ...original } = node;
      const { children: resumedChildren, ...retained } = resumed.graph.nodes[id];
      expect(retained).toEqual(original);
      expect(resumedChildren.slice(0, children.length)).toEqual(children);
    }
    expect(resumed.graph.traversalEvents.slice(0, first.graph.traversalEvents.length)).toEqual(first.graph.traversalEvents);
    expect(resumed.trial.startTime).toEqual(first.trial.startTime);
    expect(resumed.trial.endTime).toBeGreaterThan(unchanged.trial.endTime);
    expect(resumed.trial.windowEvents.slice(0, unchanged.trial.windowEvents.length)).toEqual(unchanged.trial.windowEvents);

    // Both visits remain available on one replay timeline.
    await page.goto(`${trialPath}?participantId=${resumed.participantId}&revisitPageId=e2e-resumed-trial`);
    await seekReplay(page, resumed.startTime, resumed.endTime, first.endTime, () => stateMatches(false));
    await expectState(false);
    await seekReplay(page, resumed.startTime, resumed.endTime, resumed.endTime, () => stateMatches(true));
    await expectState(true);
    await seekReplay(page, resumed.startTime, resumed.endTime, first.endTime, () => stateMatches(false));
    await expectState(false);
    expect((await savedTrial(page, demo.id, demo.identifier))?.graph).toEqual(resumed.graph);
  });
}

test('restoration warnings require the explicit Preview entry', async ({ page }) => {
  const config = {
    ...reactConfig,
    components: {
      introduction: reactConfig.components.introduction,
      legacy: {
        type: 'react-component',
        path: 'demo-dsf-study/assets/DataSerializationTask.tsx',
        parameters: {
          dataContext: 'config', format: 'JSON', taskType: 'authoring', taskId: 'legacy',
        },
        response: [],
      },
      review: {
        type: 'questionnaire', instruction: 'Review your response', previousButton: true, response: [],
      },
    },
    sequence: { order: 'fixed', components: ['introduction', 'legacy', 'review'] },
  };
  await page.route('**/demo-react-trrack/config.json', (route) => route.fulfill({ json: config }));
  await resetClientStudyState(page);
  await page.getByRole('tab', { name: 'Demo Studies', exact: true }).click();
  await page.locator('a[href="/demo-react-trrack?preview=true"]').click();
  await nextClick(page);
  const warning = page.getByRole('alert').filter({ hasText: 'has not registered state restoration' });
  await expect(warning).toHaveCount(0);
  await page.getByRole('textbox', { name: 'JSON authoring editor' }).fill('{"saved":true}');
  await page.getByRole('button', { name: 'Record task response', exact: true }).click();
  await nextClick(page);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(warning).toBeVisible();
  const path = new URL(page.url()).pathname;

  // A normal participant link stays quiet, even in the same Preview session.
  await page.goto(path);
  await expect(page.getByRole('textbox', { name: 'JSON authoring editor' })).toBeVisible();
  await expect(warning).toHaveCount(0);

  // Merely typing the Preview parameter does not establish a Preview session.
  await page.evaluate(() => sessionStorage.removeItem('revisit-preview:demo-react-trrack'));
  await page.goto(`${path}?preview=true`);
  await expect(page.getByRole('textbox', { name: 'JSON authoring editor' })).toBeVisible();
  await expect(warning).toHaveCount(0);
});

for (const demo of demos.filter((candidate) => candidate.kind === 'website')) {
  test(`${demo.id} restores legacy answers when the saved graph is absent`, async ({ page }) => {
    await page.route(`**/${demo.id}/config.json`, (route) => route.fulfill({
      json: {
        ...demo.config,
        components: {
          ...demo.config.components,
          review: {
            type: 'questionnaire', instruction: 'Review your response', previousButton: true, response: [],
          },
        },
        sequence: { order: 'fixed', components: ['introduction', demo.trial, 'review'] },
      },
    }));
    await resetClientStudyState(page);
    await page.goto(`/${demo.id}`);
    await nextClick(page);
    const frame = page.frameLocator('#root iframe');
    await expect(frame.locator('circle')).toHaveCount(1);
    await frame.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(frame.locator('circle')).toHaveCount(2);
    await nextClick(page);
    await expect(page.getByText('Review your response')).toBeVisible();
    await expect.poll(async () => Boolean(await savedTrial(page, demo.id, demo.identifier))).toBe(true);
    const first = (await savedTrial(page, demo.id, demo.identifier))!;
    const key = `dev-${demo.id}/provenance/${first.participantId}_${demo.identifier}`;
    await page.evaluate(async (storageKey) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('revisit');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('keyvaluepairs', 'readwrite');
        transaction.objectStore('keyvaluepairs').delete(storageKey);
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => { database.close(); resolve(); };
      };
    }), key);
    expect(await readStoredValue(page, key)).toBeNull();
    await page.reload();
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(frame.locator('circle')).toHaveCount(2);
    await nextClick(page);
    await expect(page.getByText('Review your response')).toBeVisible();
    await expect.poll(async () => (await savedTrial(page, demo.id, demo.identifier))?.endTime ?? 0, { timeout: 15000 }).toBeGreaterThan(first.endTime);
    const restored = (await savedTrial(page, demo.id, demo.identifier))!;
    expect(Object.values(restored.graph.nodes).map((node) => node.label)).not.toContain('Add Dot');
    expect(Object.keys(restored.graph.nodes)).toHaveLength(1);
  });
}
