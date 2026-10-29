import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useTrialAssetIdentifier } from '../useTrialAssetIdentifier';

const state = vi.hoisted(() => ({ identifier: 'purchase_0', globalStoreRevision: 0, enabled: true }));
vi.mock('../../../routes/utils', () => ({ useCurrentIdentifier: () => state.identifier }));
vi.mock('../../store', () => ({ useStoreSelector: (selector: (value: typeof state) => unknown) => selector(state) }));
vi.mock('../useStudyConfig', () => ({ useStudyConfig: () => ({ globalVariables: state.enabled ? { budget: { initialValue: 100 } } : undefined }) }));

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
