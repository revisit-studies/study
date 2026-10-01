import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

const config = {
  $schema: 'https://raw.githubusercontent.com/revisit-studies/study/v2.4.3/src/parser/StudyConfigSchema.json',
  studyMetadata: {
    title: 'Coding scroll test', version: 'test', authors: ['Test'], date: '2026-09-30',
    description: 'Coding layout regression fixture', organizations: ['Test'],
  },
  uiConfig: { logoPath: 'revisitAssets/revisitLogoSquare.svg', contactEmail: 'test@example.com', withProgressBar: false, withSidebar: false, recordAudio: true },
  components: { task: { type: 'markdown', path: 'coding-scroll/task.md', response: [] } },
  sequence: { order: 'fixed', components: ['task'] },
};

function silentAudio() {
  const audio = Buffer.alloc(44 + 16000);
  audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(16000, 28);
  audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write('data', 36); audio.writeUInt32LE(16000, 40);
  return audio;
}

async function expectAboveFooter(element: Locator, footer: Locator) {
  await expect.poll(async () => {
    const bounds = await element.boundingBox();
    const footerBounds = await footer.boundingBox();
    return !!bounds && !!footerBounds && bounds.y >= 0 && bounds.y + bounds.height <= footerBounds.y;
  }).toBe(true);
}

for (const warning of [false, true]) {
  test(`Coding final row stays editable above playback${warning ? ' and its warning' : ''}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.route('**/src/storage/initialize.ts*', async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      // Preserve other storage exports used when CI merges the PR with dev.
      const body = source.replace(/export(?=\s+async function initializeStorageEngine\b)/, '')
        + "\nexport { initializeStorageEngine } from '/tests/fixtures/codingStorage.ts';";
      await route.fulfill({ response, body });
    });
    await page.route('**/global.json', (route) => route.fulfill({ json: {
      $schema: 'https://raw.githubusercontent.com/revisit-studies/study/v2.4.3/src/parser/GlobalConfigSchema.json',
      configsList: ['coding-scroll'], configs: { 'coding-scroll': { path: 'coding-scroll/config.json' } },
    } }));
    await page.route('**/coding-scroll/config.json', (route) => route.fulfill({ json: config }));
    await page.route('**/coding-scroll/audio.wav', (route) => route.fulfill({ contentType: 'audio/wav', body: silentAudio() }));
    await page.goto(`/analysis/stats/coding-scroll/tagging/task_1?participantId=coding-participant${warning ? '&warning=1' : ''}`);

    const panel = page.getByRole('tabpanel', { name: 'Coding' });
    const footer = page.locator('footer');
    const obstruction = warning ? footer.getByRole('alert') : footer;
    await expect(panel.locator('textarea')).toHaveCount(90);
    await expect(footer.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    if (warning) await expect(footer.getByText(/Participant used Firefox/)).toBeVisible();

    // Exercise wheel scrolling before any click can auto-scroll an input into view.
    await panel.hover();
    await page.mouse.wheel(0, 10000);
    const lastRow = panel.locator('.mantine-Grid-root').last();
    const text = lastRow.locator('textarea').first();
    const annotation = lastRow.getByPlaceholder('Add Annotation');
    await expect(text).toHaveValue('Transcript row 45');
    await expectAboveFooter(text, obstruction);
    await expectAboveFooter(annotation, obstruction);
    await text.fill('Edited final transcript row');
    await annotation.fill('Final annotation');
    await lastRow.getByText('Add Text Tags', { exact: true }).click();
    await page.getByRole('option').filter({ hasText: 'Observation' }).click();
    await page.keyboard.press('Escape');
    await expect(lastRow.getByText('Observation', { exact: true })).toBeVisible();
    await expect(text).toHaveValue('Edited final transcript row');
    await expect(annotation).toHaveValue('Final annotation');

    // Enter inserts and focuses a new row; keyboard navigation must keep it clear of the footer.
    await text.press('End');
    await text.press('Enter');
    await expect(panel.locator('textarea')).toHaveCount(92);
    const insertedText = panel.locator('.mantine-Grid-root').last().locator('textarea').first();
    await expect(insertedText).toBeFocused();
    await expectAboveFooter(insertedText, obstruction);
    await expect(footer.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });
}
