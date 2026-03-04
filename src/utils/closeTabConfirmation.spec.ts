import {
  describe, expect, test, vi,
} from 'vitest';
import { handleBeforeUnload, shouldConfirmTabClose } from './closeTabConfirmation';

describe('closeTabConfirmation', () => {
  test('shouldConfirmTabClose handles trial and end states based on completion and modes', () => {
    expect(shouldConfirmTabClose(false, 'trial', false, false, true)).toBe(true);
    expect(shouldConfirmTabClose(false, 'trial', true, false, true)).toBe(false);
    expect(shouldConfirmTabClose(true, 'trial', false, false, true)).toBe(false);

    expect(shouldConfirmTabClose(false, 'end', false, false, true)).toBe(true);
    expect(shouldConfirmTabClose(false, 'end', false, true, true)).toBe(false);
    expect(shouldConfirmTabClose(false, 'end', false, false, false)).toBe(false);
  });

  test('handleBeforeUnload sets browser confirmation fields', () => {
    const preventDefault = vi.fn();
    const event = {
      preventDefault,
      returnValue: undefined,
    } as unknown as BeforeUnloadEvent;

    handleBeforeUnload(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toBe('');
  });
});
