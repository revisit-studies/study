import { act, renderHook } from '@testing-library/react';
import {
  beforeEach, expect, test, vi,
} from 'vitest';
import { useTrialAssetIdentifier } from '../useTrialAssetIdentifier';

const state = vi.hoisted(() => ({
  identifier: 'purchase_0', globalStoreRevision: 0, enabled: true, globalStoreSubmitting: false, globalStorePendingRevision: 0,
}));
vi.mock('../../../routes/utils', () => ({ useCurrentIdentifier: () => state.identifier }));
vi.mock('../../store', () => ({ useStoreSelector: (selector: (value: typeof state) => unknown) => selector(state) }));
vi.mock('../useStudyConfig', () => ({ useStudyConfig: () => ({ globalVariables: state.enabled ? { budget: { initialValue: 100 } } : undefined }) }));

beforeEach(() => {
  Object.assign(state, {
    identifier: 'purchase_0', globalStoreRevision: 0, enabled: true, globalStoreSubmitting: false, globalStorePendingRevision: 0,
  });
});

test('recording keys stay stable until navigation and revisits cannot overwrite accepted media', () => {
  const { result, rerender } = renderHook(useTrialAssetIdentifier);
  const original = result.current;
  act(() => { state.globalStoreRevision = 1; rerender(); });
  expect(result.current).toBe(original);
  act(() => { state.identifier = 'other_1'; rerender(); });
  expect(result.current).not.toBe(original);
  act(() => { state.identifier = 'purchase_0'; rerender(); });
  expect(result.current).not.toBe(original);
  const revisited = result.current;
  act(() => { state.globalStoreRevision = 2; rerender(); });
  expect(result.current).toBe(revisited);
  act(() => { state.enabled = false; rerender(); });
  expect(result.current).toBe('purchase_0');
});

test('a destination recorder and delayed submitter share the key allocated after acceptance', () => {
  const recorder = renderHook(useTrialAssetIdentifier);
  act(() => { state.globalStoreSubmitting = true; state.identifier = 'other_1'; recorder.rerender(); });
  expect(recorder.result.current).toBeUndefined();
  act(() => { state.globalStoreRevision = 1; recorder.rerender(); });
  const submitter = renderHook(useTrialAssetIdentifier);
  expect(recorder.result.current).toBe('other_1__global_1');
  expect(recorder.result.current).toBe(submitter.result.current);
});

test('returning to the submitting trial during its save waits for a new visit key', () => {
  const recorder = renderHook(useTrialAssetIdentifier);
  act(() => { state.globalStoreSubmitting = true; state.identifier = 'other_1'; recorder.rerender(); });
  act(() => { state.identifier = 'purchase_0'; recorder.rerender(); });
  expect(recorder.result.current).toBeUndefined();
  act(() => { state.globalStoreRevision = 1; recorder.rerender(); });
  const submitter = renderHook(useTrialAssetIdentifier);
  expect(recorder.result.current).toBe('purchase_0__global_1');
  expect(recorder.result.current).toBe(submitter.result.current);
});
