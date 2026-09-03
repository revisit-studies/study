/* eslint-disable no-await-in-loop */
import {
  test, expect, Locator, Page,
} from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  readStoredComponentTiming,
  resetClientStudyState,
  seekReplay,
  waitForStudyEndMessage,
} from './utils';

// Each trial ships the whole buggy line and the whole line that replaces it.
// These have to be complete lines: the edit below selects a line and retypes it.
const trials = [
  {
    component: 'fix-sum-all',
    buggyLine: 'for (let i = 1; i < nums.length; i++) {',
    fixedLine: 'for (let i = 0; i < nums.length; i++) {',
    testCount: 4,
  },
  {
    component: 'fix-max-of',
    buggyLine: 'let best = 0;',
    fixedLine: 'let best = nums[0];',
    testCount: 3,
  },
] as const;

/** Reads the running total off the "N input events" badge. */
const eventCount = async (badge: Locator) => Number((await badge.innerText()).replace(/\D/g, ''));

/** Puts the whole buggy line under one selection, ready to be typed over. */
async function selectLine(page: Page, buggyLine: string) {
  await page.locator('.cm-line', { hasText: buggyLine }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Home');
}

/** Selects the buggy line and retypes it, key by key. */
async function retypeLine(page: Page, buggyLine: string, fixedLine: string) {
  await selectLine(page, buggyLine);
  await page.keyboard.type(fixedLine);
  await expect(page.locator('.cm-line', { hasText: fixedLine })).toHaveCount(1);
  await expect(page.locator('.cm-line', { hasText: buggyLine })).toHaveCount(0);
}

test('Test CodeMirror editor stimulus records individual keys, selections, edits, and test runs', async ({
  page,
}) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(
    page,
    'Demo Studies',
    'Code Editor with CodeMirror',
  );

  await expect(page.getByText(/embed a modern code editor/i)).toBeVisible();
  await nextClick(page);

  for (const { buggyLine, fixedLine, testCount } of trials) {
    const editor = page.locator('.cm-content');
    await expect(editor).toBeVisible();
    await expect(editor).toContainText(buggyLine);

    const runButton = page.getByRole('button', {
      name: 'Run tests',
      exact: true,
    });
    const listItems = page.getByRole('listitem');
    const eventBadge = page.getByText(/\d+ input events/);

    // Answers are reported from mount, so the sidebar already shows the starter
    // code plus two zeroed counters, and no test has been run.
    await expect(listItems).toHaveCount(3);
    await expect(listItems.filter({ hasText: /^0$/ })).toHaveCount(2);
    await expect(listItems.filter({ hasText: 'PASS' })).toHaveCount(0);
    await expect(eventBadge).toHaveText('0 input events');
    await expect(editor).toHaveAttribute('contenteditable', 'true');

    // A failing run first, so the FAIL branch of the runner is exercised.
    await runButton.click();
    await expect(listItems.filter({ hasText: 'FAIL' }).first()).toBeVisible();

    // Selecting the line produces a selection entry of its own. The on-screen
    // log only keeps the most recent entries, so this is asserted before the
    // retype pushes it out of the window.
    await selectLine(page, buggyLine);
    await expect(page.getByText(/\d+ms {2}sel \d+→\d+/).first()).toBeVisible();

    await page.keyboard.type(fixedLine);
    await expect(page.locator('.cm-line', { hasText: fixedLine })).toHaveCount(
      1,
    );
    await expect(page.locator('.cm-line', { hasText: buggyLine })).toHaveCount(
      0,
    );

    // Typed characters are logged as edits, tagged with CodeMirror's own
    // user-event annotation rather than just "the document changed", and
    // carrying the caret position they left behind.
    await expect(
      page.getByText(/\d+ms {2}input(\.type)? @\d+.* caret @\d+/).first(),
    ).toBeVisible();

    // Keys that leave the document alone are recorded too -- this is what the
    // old onChange-only instrumentation missed. Each arrow logs the key press
    // and the caret move it caused, so two presses add four entries.
    const beforeNavigation = await eventCount(eventBadge);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await expect(
      page.getByText(/\d+ms {2}key ArrowDown {2}caret @\d+/),
    ).toBeVisible();
    await expect(
      page.getByText(/\d+ms {2}key ArrowUp {2}caret @\d+/),
    ).toBeVisible();
    await expect(editor).toContainText(fixedLine);
    expect(await eventCount(eventBadge)).toBe(beforeNavigation + 4);

    await runButton.click();
    await expect(
      page.getByText(`${testCount} / ${testCount} passing`),
    ).toBeVisible();
    await expect(listItems.filter({ hasText: 'FAIL' })).toHaveCount(0);

    // The sidebar reactive responses mirror the run: one PASS line per test
    // case, the run counter, the input-event counter, and the final code.
    await expect(listItems.filter({ hasText: 'PASS' })).toHaveCount(testCount);
    await expect(listItems.filter({ hasText: fixedLine })).toHaveCount(1);
    await expect(listItems.filter({ hasText: /^\d+$/ })).toHaveCount(2);
    await expect(listItems.filter({ hasText: /^2$/ })).toHaveCount(1);
    await expect(
      listItems.filter({
        hasText: new RegExp(`^${await eventCount(eventBadge)}$`),
      }),
    ).toHaveCount(1);

    await nextClick(page);
    await page.waitForTimeout(100);
  }

  await waitForStudyEndMessage(page);
});

test('Test CodeMirror editor replays the participant session', async ({
  page,
}) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(
    page,
    'Demo Studies',
    'Code Editor with CodeMirror',
  );
  await nextClick(page);

  const runButton = page.getByRole('button', {
    name: 'Run tests',
    exact: true,
  });
  let replayPath = '';

  for (const [index, { buggyLine, fixedLine, testCount }] of trials.entries()) {
    await expect(page.locator('.cm-content')).toContainText(buggyLine);
    await runButton.click();
    await retypeLine(page, buggyLine, fixedLine);
    await runButton.click();
    await expect(
      page.getByText(`${testCount} / ${testCount} passing`),
    ).toBeVisible();

    if (index === 0) {
      replayPath = new URL(page.url()).pathname;
    }
    await nextClick(page);
    await page.waitForTimeout(100);
  }

  await waitForStudyEndMessage(page);

  const [{
    buggyLine, fixedLine, testCount, component,
  }] = trials;
  await expect
    .poll(
      async () => (await readStoredComponentTiming(page, component))?.participantId ?? '',
      { timeout: 15000 },
    )
    .not.toBe('');
  const recording = await readStoredComponentTiming(page, component);
  if (!recording) {
    throw new Error(`No recorded timing found for ${component}`);
  }

  await page.goto(
    `${replayPath}?participantId=${recording.participantId}&revisitPageId=e2e-codemirror-replay`,
  );

  const editor = page.locator('.cm-content');
  await expect(editor).toBeVisible({ timeout: 15000 });

  // Replay locks the editor so an analyst scrubbing a session cannot type into
  // the participant's document.
  await expect(editor).toHaveAttribute('contenteditable', 'false', {
    timeout: 15000,
  });
  await expect(
    page.getByRole('button', { name: 'Run tests', exact: true }),
  ).toBeDisabled();

  // At the start of the trial the participant had not touched anything yet.
  await expect(editor).toContainText(buggyLine, { timeout: 15000 });
  await expect(page.getByText('0 input events')).toBeVisible();

  // Seeking to the end of the trial rebuilds the document, the caret, the input
  // log, and the test results as they stood when the participant finished.
  await seekReplay(
    page,
    recording.startTime,
    recording.endTime,
    recording.endTime,
    async () => (await editor.innerText()).includes(fixedLine),
  );
  await expect(editor).toContainText(fixedLine, { timeout: 15000 });
  await expect(editor).not.toContainText(buggyLine);
  await expect(
    page.getByText(`${testCount} / ${testCount} passing`),
  ).toBeVisible({ timeout: 15000 });
  expect(await eventCount(page.getByText(/\d+ input events/))).toBeGreaterThan(
    0,
  );
  await expect(
    page.getByText(/\d+ms {2}(key |caret @|sel |input)/).first(),
  ).toBeVisible();

  // Seeking back to the start rewinds the document again.
  await seekReplay(
    page,
    recording.startTime,
    recording.endTime,
    recording.startTime,
    async () => (await editor.innerText()).includes(buggyLine),
  );
  await expect(editor).toContainText(buggyLine, { timeout: 15000 });
});
