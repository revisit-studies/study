import { act, renderHook } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { useEvent } from '../useEvent';

describe('useEvent', () => {
  test('returns a stable callback reference across re-renders', () => {
    const handler = vi.fn();
    const { result, rerender } = renderHook(() => useEvent(handler));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  test('invokes the current handler when the callback is called', () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useEvent(handler));
    act(() => { result.current(); });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('always calls the latest handler after props update', () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const { result, rerender } = renderHook(
      ({ h }: { h: () => void }) => useEvent(h),
      { initialProps: { h: firstHandler } },
    );

    act(() => { result.current(); });
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).not.toHaveBeenCalled();

    rerender({ h: secondHandler });

    act(() => { result.current(); });
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  test('forwards arguments to the handler', () => {
    const handler = vi.fn((a: number, b: string) => `${a}-${b}`);
    const { result } = renderHook(() => useEvent(handler));
    act(() => { result.current(42, 'hello'); });
    expect(handler).toHaveBeenCalledWith(42, 'hello');
  });
});
