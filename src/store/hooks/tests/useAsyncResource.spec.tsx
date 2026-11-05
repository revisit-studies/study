import { act, renderHook, waitFor } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { useAsyncResource } from '../useAsyncResource';

describe('useAsyncResource', () => {
  test('stays unresolved without a request key', () => {
    const load = vi.fn();
    const { result } = renderHook(() => useAsyncResource(undefined, load));

    expect(result.current).toEqual({ key: undefined, status: 'unresolved' });
    expect(load).not.toHaveBeenCalled();
  });

  test('ignores an older request that resolves after the current request', async () => {
    const resolvers: Record<string, (value: string) => void> = {};
    const load = vi.fn((key: string) => new Promise<string>((resolve) => {
      resolvers[key] = resolve;
    }));
    const { result, rerender } = renderHook(
      ({ key }: { key: string | undefined }) => useAsyncResource(key, load),
      { initialProps: { key: 'first' } },
    );

    await waitFor(() => expect(load).toHaveBeenCalledWith('first'));
    rerender({ key: 'second' });
    await waitFor(() => expect(load).toHaveBeenCalledWith('second'));

    await act(async () => {
      resolvers.first('stale');
    });
    expect(result.current).toMatchObject({ key: 'second', status: 'loading' });

    await act(async () => {
      resolvers.second('current');
    });
    await waitFor(() => expect(result.current).toEqual({
      key: 'second', status: 'success', value: 'current',
    }));
  });

  test('distinguishes missing resources and loader errors', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network failure'));
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useAsyncResource(key, load),
      { initialProps: { key: 'missing' } },
    );

    await waitFor(() => expect(result.current.status).toBe('missing'));
    rerender({ key: 'error' });
    await waitFor(() => expect(result.current).toMatchObject({ key: 'error', status: 'error' }));
  });
});
