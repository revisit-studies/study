import { test, expect } from '@playwright/test';
import { getSequenceFlatMap } from '../src/utils/getSequenceFlatMap';

test('test', async ({ page }) => {
  await page.goto('/test-randomization');

  // Check for introduction page
  const introText = await page.getByText('This is a test file for the introduction of the project.');
  await expect(introText).toBeVisible({ timeout: 5000 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sequenceArray: any[] = await page.evaluate(async () => {
    let db;
    const request = indexedDB.open('revisit');

    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      request.onsuccess = async (event: any) => {
        db = event.target.result;
        const transaction = db.transaction(['keyvaluepairs'], 'readonly');
        const store = transaction.objectStore('keyvaluepairs');
        const sequenceArrayInternal = store.get('dev-test-randomization/_sequenceArray');
        sequenceArrayInternal.onsuccess = () => resolve(sequenceArrayInternal.result);
      };
    });
  });

  expect(sequenceArray).not.toContain(undefined);
  expect(sequenceArray.length).toBe(1000);

  // Flatten the sequence array
  const flattenedSequenceArray = sequenceArray.map((x) => getSequenceFlatMap(x));

  // Check that each sequence is as expected
  const sequenceOccurences = flattenedSequenceArray.map((sequence) => {
    expect(sequence.length).toBe(24);

    const occurrences: Record<string, number | undefined> = sequence.reduce((acc, curr) => { acc[curr] = (acc[curr] || 0) + 1; return acc; }, {});

    expect(occurrences.introduction).toBe(2);
    expect(occurrences.end).toBe(1);
    expect(occurrences.break1).toBe(6);
    expect(occurrences.break2).toBe(4);

    expect(
      (occurrences.trial1 || 0)
      + (occurrences.trial2 || 0)
      + (occurrences.trial3 || 0)
      + (occurrences.trial4 || 0)
      + (occurrences.trial5 || 0)
      + (occurrences.trial6 || 0)
      + (occurrences.trial7 || 0)
      + (occurrences.trial8 || 0)
      + (occurrences.trial9 || 0)
      + (occurrences.trial10 || 0),
    ).toBe(5);

    expect(
      (occurrences.trial11 || 0)
      + (occurrences.trial12 || 0)
      + (occurrences.trial13 || 0)
      + (occurrences.trial14 || 0)
      + (occurrences.trial15 || 0)
      + (occurrences.trial16 || 0)
      + (occurrences.trial17 || 0)
      + (occurrences.trial18 || 0)
      + (occurrences.trial19 || 0)
      + (occurrences.trial20 || 0),
    ).toBe(5);

    return occurrences;
  });

  // Check that across participants, the sequence is as expected
  const globalOcurrences = sequenceOccurences.reduce((acc, curr) => {
    Object.entries(curr).forEach(([key, value]) => {
      if (acc[key] === undefined) {
        acc[key] = value;
      } else {
        acc[key]! += value!;
      }
    });
    return acc;
  }, {});

  expect(globalOcurrences.introduction).toBe(2000);
  expect(globalOcurrences.break1).toBe(6000);
  expect(globalOcurrences.break2).toBe(4000);
  expect(globalOcurrences.end).toBe(1000);

  expect(globalOcurrences.trial1).toBe(500);
  expect(globalOcurrences.trial2).toBe(500);
  expect(globalOcurrences.trial3).toBe(500);
  expect(globalOcurrences.trial4).toBe(500);
  expect(globalOcurrences.trial5).toBe(500);
  expect(globalOcurrences.trial6).toBe(500);
  expect(globalOcurrences.trial7).toBe(500);
  expect(globalOcurrences.trial8).toBe(500);
  expect(globalOcurrences.trial9).toBe(500);
  expect(globalOcurrences.trial10).toBe(500);

  expect(globalOcurrences.trial11).toBe(500);
  expect(globalOcurrences.trial12).toBe(500);
  expect(globalOcurrences.trial13).toBe(500);
  expect(globalOcurrences.trial14).toBe(500);
  expect(globalOcurrences.trial15).toBe(500);
  expect(globalOcurrences.trial16).toBe(500);
  expect(globalOcurrences.trial17).toBe(500);
  expect(globalOcurrences.trial18).toBe(500);
  expect(globalOcurrences.trial19).toBe(500);
  expect(globalOcurrences.trial20).toBe(500);

  // Check to make sure that the admin panel renders with such a complex sequence
  await page.locator('.studyBrowserMenuDropdown').click();
  await page.getByRole('menuitem', { name: 'Study Browser' }).click();

  const sequenceHeader = await page.locator('#root').getByText('Study Browser');
  await expect(sequenceHeader).toBeVisible();
});
