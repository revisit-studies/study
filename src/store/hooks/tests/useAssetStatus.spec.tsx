import { act, renderHook } from '@testing-library/react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AssetStatus } from '../../types';
import { useAssetLoadStatus, useAssetStatus } from '../useAssetStatus';

let mockIdentifier = 'first_0';
let mockIsAnalysis = false;
const mockDispatch = vi.fn();
const mockSetAssetStatus = vi.fn((payload) => ({ type: 'setAssetStatus', payload }));

vi.mock('../../../routes/utils', () => ({
  useCurrentIdentifier: () => mockIdentifier,
}));

vi.mock('../../store', () => ({
  useStoreDispatch: () => mockDispatch,
  useStoreActions: () => ({ setAssetStatus: mockSetAssetStatus }),
}));

vi.mock('../useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockIdentifier = 'first_0';
  mockIsAnalysis = false;
});

describe('useAssetStatus', () => {
  test('syncs status to the current trial and resets it on unmount', () => {
    const { rerender, unmount } = renderHook(
      ({ status }: { status: AssetStatus }) => useAssetStatus(status),
      { initialProps: { status: 'loading' } },
    );
    expect(mockDispatch).toHaveBeenLastCalledWith({
      type: 'setAssetStatus', payload: { identifier: 'first_0', status: 'loading' },
    });

    rerender({ status: 'ready' });
    expect(mockDispatch).toHaveBeenLastCalledWith({
      type: 'setAssetStatus', payload: { identifier: 'first_0', status: 'ready' },
    });

    unmount();
    expect(mockDispatch).toHaveBeenLastCalledWith({
      type: 'setAssetStatus', payload: { identifier: 'first_0', status: 'loading' },
    });
  });

  test('resets the previous trial and writes subsequent status to the new trial', () => {
    const { rerender } = renderHook(() => useAssetStatus('ready'));
    mockDispatch.mockClear();
    mockIdentifier = 'second_1';
    rerender();

    expect(mockDispatch).toHaveBeenNthCalledWith(1, {
      type: 'setAssetStatus', payload: { identifier: 'first_0', status: 'loading' },
    });
    expect(mockDispatch).toHaveBeenLastCalledWith({
      type: 'setAssetStatus', payload: { identifier: 'second_1', status: 'ready' },
    });
  });

  test('does not change validation during analysis, including cleanup', () => {
    mockIsAnalysis = true;
    const { rerender, unmount } = renderHook(
      ({ status }: { status: AssetStatus }) => useAssetStatus(status),
      { initialProps: { status: 'loading' } },
    );
    rerender({ status: 'error' });
    unmount();

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe('useAssetLoadStatus', () => {
  test('starts loading and resets when the trial changes even if the path stays the same', () => {
    const { result, rerender } = renderHook(
      ({ key }) => useAssetLoadStatus(key),
      { initialProps: { key: 'first_0:image.png' } },
    );
    expect(result.current.status).toBe('loading');
    act(() => result.current.onReady());
    expect(result.current.status).toBe('ready');

    rerender({ key: 'second_1:image.png' });
    expect(result.current.status).toBe('loading');
    act(() => result.current.onError());
    expect(result.current.status).toBe('error');
  });

  test.each<'onReady' | 'onError'>(['onReady', 'onError'])('ignores a late %s callback from the previous request', (callback) => {
    const { result, rerender } = renderHook(
      ({ key }) => useAssetLoadStatus(key),
      { initialProps: { key: 'first_0:old.png' } },
    );
    const oldCallback = result.current[callback];
    rerender({ key: 'first_0:new.png' });

    act(() => oldCallback());
    expect(result.current.status).toBe('loading');

    act(() => result.current.onReady());
    act(() => oldCallback());
    expect(result.current.status).toBe('ready');
  });
});
