import {
  describe, expect, test, vi,
} from 'vitest';
import { handleBeforeUnload, shouldConfirmTabClose } from '../closeTabConfirmation';

describe('closeTabConfirmation', () => {
  test('returns false when isAnalysis is true', () => {
    expect(shouldConfirmTabClose(false, 'trial', false, false, true, false)).toBe(true);
    expect(shouldConfirmTabClose(false, 'trial', true, false, true, false)).toBe(false);
    expect(shouldConfirmTabClose(true, 'trial', false, false, true, false)).toBe(false);
  });

  test('returns false when developmentModeEnabled is true', () => {
    expect(shouldConfirmTabClose(false, 'trial', true, false, true, false)).toBe(false);
    expect(shouldConfirmTabClose(false, 'end', true, false, true, false)).toBe(false);
  });

  test('returns true for end component when data collection enabled and not completed', () => {
    expect(shouldConfirmTabClose(false, 'end', false, false, true, false)).toBe(true);
  });

  test('returns false for end component when completed', () => {
    expect(shouldConfirmTabClose(false, 'end', false, true, true, false)).toBe(false);
  });

  test('returns false for end component when data collection disabled', () => {
    expect(shouldConfirmTabClose(false, 'end', false, false, false, false)).toBe(false);
  });

  test('returns true for end component when isSubmittingFinal is true', () => {
    expect(shouldConfirmTabClose(false, 'end', false, true, false, true)).toBe(true);
  });

  test('returns true for any non-end component in normal mode', () => {
    expect(shouldConfirmTabClose(false, 'trial', false, false, true, false)).toBe(true);
    expect(shouldConfirmTabClose(false, 'intro', false, false, true, false)).toBe(true);
    expect(shouldConfirmTabClose(false, 'survey', false, true, true, false)).toBe(true);
  });

  test('handleBeforeUnload calls preventDefault', () => {
    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const spy = vi.spyOn(event, 'preventDefault');

    handleBeforeUnload(event);

    expect(spy).toHaveBeenCalledOnce();
  });
});
