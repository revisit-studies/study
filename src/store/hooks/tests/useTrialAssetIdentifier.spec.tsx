import { act, renderHook } from '@testing-library/react';
import { createContext, type ReactNode } from 'react';
import {
  beforeEach, expect, test, vi,
} from 'vitest';
import { useTrialAssetIdentifier } from '../useTrialAssetIdentifier';
import { StudyStoreContext, type StudyStore } from '../../store';

const state = vi.hoisted(() => ({
  identifier: 'purchase_0', globalStoreRevision: 0, enabled: true, globalStoreSubmitting: false, globalStorePendingRevision: 0,
}));
vi.mock('../../../routes/utils', () => ({ useCurrentIdentifier: () => state.identifier }));
vi.mock('../../store', async () => ({
  StudyStoreContext: (await vi.importActual<{ createContext: typeof createContext }>('react')).createContext(null),
  useStoreSelector: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock('../useStudyConfig', () => ({ useStudyConfig: () => ({ globalVariables: state.enabled ? { budget: { initialValue: 100 } } : undefined }) }));

let owner: StudyStore;
const newOwner = () => ({ trialAssetEntry: undefined } as unknown as StudyStore);
const wrapper = (store: StudyStore) => function Wrapper({ children }: { children: ReactNode }) {
  return <StudyStoreContext.Provider value={store}>{children}</StudyStoreContext.Provider>;
};
const mount = (store = owner) => renderHook(useTrialAssetIdentifier, { wrapper: wrapper(store) });

beforeEach(() => {
  owner = newOwner();
  Object.assign(state, {
    identifier: 'purchase_0', globalStoreRevision: 0, enabled: true, globalStoreSubmitting: false, globalStorePendingRevision: 0,
  });
});

test('recording keys stay stable until navigation and revisits cannot overwrite accepted media', () => {
  const { result, rerender } = mount();
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
  const recorder = mount();
  act(() => { state.globalStoreSubmitting = true; state.identifier = 'other_1'; recorder.rerender(); });
  expect(recorder.result.current).toBeUndefined();
  act(() => { state.globalStoreRevision = 1; recorder.rerender(); });
  const submitter = mount();
  expect(recorder.result.current).toMatch(/^other_1__global_/);
  expect(recorder.result.current).toBe(submitter.result.current);
});

test('returning to the submitting trial during its save waits for a new visit key', () => {
  const recorder = mount();
  act(() => { state.globalStoreSubmitting = true; state.identifier = 'other_1'; recorder.rerender(); });
  act(() => { state.identifier = 'purchase_0'; recorder.rerender(); });
  expect(recorder.result.current).toBeUndefined();
  act(() => { state.globalStoreRevision = 1; recorder.rerender(); });
  const submitter = mount();
  expect(recorder.result.current).toMatch(/^purchase_0__global_/);
  expect(recorder.result.current).toBe(submitter.result.current);
});

test('separate browsers visiting the same trial and revision cannot overwrite each other media', () => {
  const first = mount(newOwner());
  const second = mount(newOwner());
  expect(first.result.current).not.toBe(second.result.current);
  const media = new Map([[first.result.current, 'accepted recording']]);
  media.set(second.result.current, 'late cleanup from another browser');
  expect(media.get(first.result.current)).toBe('accepted recording');
});

test('a revisit without a submission gets a new key and a delayed submitter shares it after acceptance', () => {
  const recorder = mount();
  const original = recorder.result.current;
  act(() => { state.identifier = 'other_1'; recorder.rerender(); });
  act(() => { state.identifier = 'purchase_0'; recorder.rerender(); });
  expect(recorder.result.current).not.toBe(original);
  const revisited = recorder.result.current;
  act(() => { state.globalStoreRevision += 1; recorder.rerender(); });
  const submitter = mount();
  expect(submitter.result.current).toBe(revisited);
});

test('changing the participant store at the same trial allocates a different key', () => {
  const hook = renderHook(useTrialAssetIdentifier, {
    wrapper: ({ children }: { children: ReactNode }) => <StudyStoreContext.Provider value={owner}>{children}</StudyStoreContext.Provider>,
  });
  const original = hook.result.current;
  owner = newOwner();
  hook.rerender();
  expect(hook.result.current).not.toBe(original);
});
