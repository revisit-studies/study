import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useGlobalStore } from '../useGlobalStore';
import { createGlobalStoreSubmission } from '../../globalStoreProvenance';
import { makeStoredAnswer } from '../../../tests/utils';
import type { StoreState } from '../../types';

const state = vi.hoisted(() => ({ identifier: 'B', value: {} as StoreState }));
vi.mock('../../../routes/utils', () => ({ useCurrentIdentifier: () => state.identifier }));
vi.mock('../../store', () => ({ useStoreSelector: (selector: (value: StoreState) => unknown) => selector(state.value) }));
vi.mock('../useStudyConfig', () => ({ useStudyConfig: () => ({ globalVariables: { budget: { initialValue: 100 } } }) }));

test('a previous replay trial cannot supply the entry store for a newly selected trial', () => {
  const a = createGlobalStoreSubmission(undefined, { budget: { initialValue: 100 } }, makeStoredAnswer({ identifier: 'A' }), { budget: 70 }, [], {});
  state.value = { globalStoreGraph: a.graph, analysisProvState: { globalStore: { values: { budget: 1 }, submission: null } }, analysisGlobalStoreIdentifier: 'A' } as unknown as StoreState;
  const { result, rerender } = renderHook(useGlobalStore);
  expect(result.current.budget).toBe(70);
  act(() => { state.value.analysisGlobalStoreIdentifier = 'B'; rerender(); });
  expect(result.current.budget).toBe(1);
});
