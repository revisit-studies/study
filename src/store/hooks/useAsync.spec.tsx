import { act, renderHook, waitFor } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { useAsync } from './useAsync';

describe('useAsync', () => {
  test('starts in idle state with null value and error', () => {
    const asyncFn = vi.fn(() => Promise.resolve('data'));
    const { result } = renderHook(() => useAsync(asyncFn));
    expect(result.current.status).toBe('idle');
    expect(result.current.value).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test('transitions idle → pending → success on execute', async () => {
    const asyncFn = vi.fn(() => Promise.resolve('hello'));
    const { result } = renderHook(() => useAsync(asyncFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.status).toBe('success');
    expect(result.current.value).toBe('hello');
    expect(result.current.error).toBeNull();
  });

  test('transitions to error state when the async function rejects', async () => {
    const networkFailure = new Error('network failure');
    const asyncFn = vi.fn(() => Promise.reject(networkFailure));
    const { result } = renderHook(() => useAsync(asyncFn));

    await act(async () => {
      try {
        await result.current.execute();
      } catch {
        // expected rejection
      }
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(networkFailure);
    expect(result.current.value).toBeNull();
  });

  test('fires immediately when immediate params are provided', async () => {
    const asyncFn = vi.fn((x: string) => Promise.resolve(x.toUpperCase()));
    const { result } = renderHook(() => useAsync(asyncFn, ['initial']));

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.value).toBe('INITIAL');
    expect(asyncFn).toHaveBeenCalledWith('initial');
  });

  test('does not execute immediately when immediate is null', () => {
    const asyncFn = vi.fn(() => Promise.resolve('x'));
    renderHook(() => useAsync(asyncFn, null));
    expect(asyncFn).not.toHaveBeenCalled();
  });

  test('passes arguments through to the async function', async () => {
    const asyncFn = vi.fn((a: number, b: number) => Promise.resolve(a + b));
    const { result } = renderHook(() => useAsync(asyncFn));

    await act(async () => {
      await result.current.execute(3, 4);
    });

    expect(asyncFn).toHaveBeenCalledWith(3, 4);
    expect(result.current.value).toBe(7);
  });

  test('does not update state after the component unmounts', async () => {
    let resolvePromise!: (v: string) => void;
    const asyncFn = vi.fn(
      () => new Promise<string>((res) => { resolvePromise = res; }),
    );
    const { result, unmount } = renderHook(() => useAsync(asyncFn));

    act(() => { result.current.execute(); });
    unmount();

    await act(async () => { resolvePromise('late'); });

    // After unmount the status should still be 'pending' — setValue was never called
    expect(result.current.status).toBe('pending');
    expect(result.current.value).toBeNull();
  });

  test('swallows synchronous errors thrown during immediate execution', () => {
    const asyncFn = vi.fn(() => { throw new Error('sync error'); });
    // Should not throw — the try/catch in useDeepCompareEffect swallows it
    expect(() => renderHook(() => useAsync(asyncFn, []))).not.toThrow();
  });
});
