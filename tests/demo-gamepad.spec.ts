/* eslint-disable no-await-in-loop */
import { test, expect, Page } from '@playwright/test';
import { nextClick, openStudyFromLanding, resetClientStudyState } from './utils';
import { FACE_BUTTON_COLORS } from '../src/utils/gamepadButtons';
import { getColorForKey, normalizeActionName } from '../src/components/audioAnalysis/provenanceColors';

const FACE_BUTTON_INDEX: Record<string, number> = {
  A: 0, B: 1, X: 2, Y: 3,
};

// Matches "gamepad-large-targets" in public/demo-gamepad/config.json.
const TARGET_COUNT = 6;
const TARGET_RADIUS = 44;

/**
 * Installs a synthetic gamepad plus a fake screen-capture stream.
 *
 * Real controllers cannot be attached to a headless browser, so this replaces
 * `navigator.getGamepads` with a snapshot the test drives. The stimulus polls that
 * snapshot exactly as it would a real device, so everything above the API boundary
 * is the production code path.
 */
async function installFakeGamepad(page: Page) {
  await page.addInitScript(() => {
    const state = {
      connected: false,
      axes: [0, 0, 0, 0],
      buttons: new Array(17).fill(false) as boolean[],
    };
    (window as unknown as { __gamepadState: typeof state }).__gamepadState = state;

    navigator.getGamepads = () => (state.connected
      ? [{
        id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b12)',
        index: 0,
        mapping: 'standard',
        connected: true,
        timestamp: performance.now(),
        axes: state.axes.slice(),
        buttons: state.buttons.map((pressed) => ({ pressed, touched: pressed, value: pressed ? 1 : 0 })),
      }]
      : []) as unknown as ReturnType<typeof navigator.getGamepads>;

    if (navigator.mediaDevices) {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext('2d')!;
        const paint = () => {
          context.fillStyle = `hsl(${(Date.now() / 20) % 360}, 60%, 70%)`;
          context.fillRect(0, 0, canvas.width, canvas.height);
        };
        paint();
        setInterval(paint, 100);
        return (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(10);
      };
    }
  });
}

async function connectGamepad(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __gamepadState: { connected: boolean } }).__gamepadState.connected = true;
  });
}

async function pressButton(page: Page, button: string) {
  const index = FACE_BUTTON_INDEX[button];
  await page.evaluate((i) => {
    (window as unknown as { __gamepadState: { buttons: boolean[] } }).__gamepadState.buttons[i] = true;
  }, index);
  await page.waitForTimeout(80);
  await page.evaluate((i) => {
    (window as unknown as { __gamepadState: { buttons: boolean[] } }).__gamepadState.buttons[i] = false;
  }, index);
  await page.waitForTimeout(80);
}

async function setStick(page: Page, x: number, y: number) {
  await page.evaluate(([axisX, axisY]) => {
    const { __gamepadState: gamepadState } = window as unknown as { __gamepadState: { axes: number[] } };
    gamepadState.axes[0] = axisX;
    gamepadState.axes[1] = axisY;
  }, [x, y]);
}

async function readPoint(page: Page, testId: string) {
  const element = page.getByTestId(testId);
  return {
    x: Number(await element.getAttribute('data-x')),
    y: Number(await element.getAttribute('data-y')),
    button: await element.getAttribute('data-button'),
  };
}

/** Holds the stick toward the target until the reticle is comfortably inside it. */
async function steerOntoTarget(page: Page) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const target = await readPoint(page, 'gamepad-target');
    const reticle = await readPoint(page, 'gamepad-reticle');
    const dx = target.x - reticle.x;
    const dy = target.y - reticle.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= TARGET_RADIUS * 0.4) {
      await setStick(page, 0, 0);
      return;
    }

    // Ease off when close so the reticle settles instead of oscillating.
    const scale = distance < 70 ? 0.3 : 1;
    const longest = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    await setStick(page, (dx / longest) * scale, (dy / longest) * scale);
    await page.waitForTimeout(50);
  }

  await setStick(page, 0, 0);
  throw new Error('Could not steer the reticle onto the target');
}

/**
 * Reads a finished trial back out of the browser's storage: reVISit keeps
 * windowEvents on the answer, and writes the Trrack graph to its own key.
 */
async function readStoredTrial(page: Page, trialPrefix: string) {
  return page.evaluate(async (prefix) => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const request = indexedDB.open('revisit');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const store = db.transaction('keyvaluepairs', 'readonly').objectStore('keyvaluepairs');
    const keys: IDBValidKey[] = await new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const get = (key: IDBValidKey): Promise<unknown> => new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    type StoredWindowEvent = [number, string, unknown];
    type StoredAnswerShape = { windowEvents?: StoredWindowEvent[] };
    type ParticipantShape = { answers: Record<string, StoredAnswerShape> };
    type ProvenanceNodeShape = { event?: string; sideEffects?: { do?: { type?: string }[] } };
    type StoredProvenanceShape = { stimulus?: { nodes?: Record<string, ProvenanceNodeShape> } };

    const stringKeys = keys.map(String);

    const participantKey = stringKeys.find((key) => key.includes('/participants/') && key.endsWith('_participantData'));
    const participant = participantKey ? await get(participantKey) as ParticipantShape : null;
    const answerKey = participant
      ? Object.keys(participant.answers).find((key) => key.startsWith(prefix))
      : undefined;
    const answer = participant && answerKey ? participant.answers[answerKey] : null;

    const provenanceKey = stringKeys.find((key) => key.toLowerCase().includes('provenance') && key.includes(prefix));
    let provenance = provenanceKey ? await get(provenanceKey) : null;
    if (provenance instanceof Blob) provenance = JSON.parse(await provenance.text());
    if (typeof provenance === 'string') provenance = JSON.parse(provenance);
    const nodes = (provenance as StoredProvenanceShape | null)?.stimulus?.nodes ?? {};

    return {
      windowEventKinds: Array.from(new Set((answer?.windowEvents ?? []).map((event) => event[1]))),
      nodeActionTypes: Object.values(nodes).map(
        (node) => node?.sideEffects?.do?.[0]?.type ?? node?.event ?? '',
      ),
    };
  }, trialPrefix);
}

test.describe('Gamepad stimulus with provenance and screen recording', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeGamepad(page);
    await resetClientStudyState(page);
  });

  test('plays a controller-driven trial and records hits and misses', async ({ page }) => {
    await openStudyFromLanding(page, 'Demo Studies', 'Gamepad Input with Provenance');

    await expect(page.getByText('Gamepad Input with Provenance').first()).toBeVisible({ timeout: 15000 });
    await nextClick(page);

    // Screen recording permission, backed by the fake display stream.
    await page.getByRole('button', { name: 'Start Recording' }).click();
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    await expect(continueButton).toBeEnabled({ timeout: 15000 });
    await continueButton.click();

    // Nothing is polled until the browser hands the page a gamepad.
    await expect(page.getByText('Press any button on your controller')).toBeVisible({ timeout: 15000 });

    await connectGamepad(page);
    await expect(page.getByText('Press any button on your controller')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('gamepad-target')).toBeVisible();
    await expect(page.getByText(/Xbox Wireless Controller/)).toBeVisible();

    // A wrong button counts as a miss and leaves the target in place.
    const firstTarget = await readPoint(page, 'gamepad-target');
    const wrongButton = Object.keys(FACE_BUTTON_INDEX).find((button) => button !== firstTarget.button)!;
    await steerOntoTarget(page);
    await pressButton(page, wrongButton);
    await expect(page.getByTestId('gamepad-misses')).toHaveText('1');
    await expect(page.getByTestId('gamepad-hits')).toHaveText('0');
    await expect(page.getByTestId('gamepad-target')).toBeVisible();

    // Now clear every target with the correct button.
    for (let hit = 0; hit < TARGET_COUNT; hit += 1) {
      await steerOntoTarget(page);
      const target = await readPoint(page, 'gamepad-target');
      await pressButton(page, target.button!);
      await expect(page.getByTestId('gamepad-hits')).toHaveText(String(hit + 1), { timeout: 10000 });
    }

    await expect(page.getByTestId('gamepad-outcome')).toContainText('task complete');

    // The reactive responses in the sidebar mirror the game's own tally.
    const listItems = page.getByRole('listitem');
    await expect(listItems.filter({ hasText: String(TARGET_COUNT) }).first()).toBeVisible({ timeout: 10000 });
  });

  test('stores gamepad telemetry and button-colored provenance', async ({ page }) => {
    await openStudyFromLanding(page, 'Demo Studies', 'Gamepad Input with Provenance');
    await nextClick(page);

    await page.getByRole('button', { name: 'Start Recording' }).click();
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    await expect(continueButton).toBeEnabled({ timeout: 15000 });
    await continueButton.click();

    await connectGamepad(page);
    await expect(page.getByTestId('gamepad-target')).toBeVisible({ timeout: 15000 });

    for (let hit = 0; hit < 2; hit += 1) {
      await steerOntoTarget(page);
      const target = await readPoint(page, 'gamepad-target');
      await pressButton(page, target.button!);
      await expect(page.getByTestId('gamepad-hits')).toHaveText(String(hit + 1), { timeout: 10000 });
    }

    // Answers, windowEvents and provenance are flushed when the component advances.
    await nextClick(page);
    await expect(page.getByTestId('gamepad-target')).toBeVisible({ timeout: 15000 });

    // Writes are debounced, so wait for the trial to land in storage.
    await expect.poll(
      async () => (await readStoredTrial(page, 'gamepad-large-targets')).windowEventKinds,
      { timeout: 30000 },
    ).toEqual(expect.arrayContaining([
      'gamepadconnection', 'gamepadbuttondown', 'gamepadbuttonup', 'gamepadaxis',
    ]));

    await expect.poll(
      async () => (await readStoredTrial(page, 'gamepad-large-targets')).nodeActionTypes.length,
      { timeout: 30000 },
    ).toBeGreaterThan(0);

    const stored = await readStoredTrial(page, 'gamepad-large-targets');

    // The semantic channel records presses under the action types that the analysis
    // timeline colors by, and keeps the 60Hz stick stream out of the graph.
    expect(stored.nodeActionTypes).toEqual(expect.arrayContaining(['gamepad-spawn-target']));
    const pressTypes = stored.nodeActionTypes.filter((type) => type.startsWith('gamepad-press-'));
    expect(pressTypes.length).toBeGreaterThanOrEqual(2);
    expect(stored.nodeActionTypes).not.toContain('gamepad-axis');

    // Each press resolves to its own button's color rather than a hashed one.
    pressTypes.forEach((type) => {
      const button = type.replace('gamepad-press-', '').toUpperCase() as keyof typeof FACE_BUTTON_COLORS;
      expect(getColorForKey(normalizeActionName(type))).toBe(FACE_BUTTON_COLORS[button]);
    });
  });

  test('captures nothing for a study that has not opted in', async ({ page }) => {
    // demo-html sets no captureGamepad, so an attached controller must stay invisible
    // to it -- the polling loop should not even run.
    await openStudyFromLanding(page, 'Demo Studies', 'HTML as a Stimulus');
    await nextClick(page);

    await expect(page.getByText('How many bars have a value greater than 1?')).toBeVisible({ timeout: 15000 });
    await connectGamepad(page);

    await pressButton(page, 'A');
    await pressButton(page, 'B');
    await setStick(page, 1, 0);
    await page.waitForTimeout(300);
    await setStick(page, 0, 0);

    await page.getByPlaceholder('0-7').fill('4');
    await nextClick(page);

    // Wait until this trial's events are on disk, so the assertion below cannot pass
    // simply because nothing was recorded yet.
    await expect.poll(
      async () => (await readStoredTrial(page, 'barChart')).windowEventKinds.length,
      { timeout: 30000 },
    ).toBeGreaterThan(0);

    const stored = await readStoredTrial(page, 'barChart');
    expect(stored.windowEventKinds.filter((kind) => kind.startsWith('gamepad'))).toEqual([]);
  });
});
