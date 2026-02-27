import {
  describe, expect, test, vi,
} from 'vitest';
import { handleBeforeUnload, shouldConfirmTabClose } from './closeTabConfirmation';

describe('closeTabConfirmation', () => {
  test('shouldConfirmTabClose returns true only for participant non-end components', () => {
    expect(shouldConfirmTabClose(false, 'trial')).toBe(true);
    expect(shouldConfirmTabClose(false, 'end')).toBe(false);
    expect(shouldConfirmTabClose(true, 'trial')).toBe(false);
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
