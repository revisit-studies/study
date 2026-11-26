import { act, renderHook } from '@testing-library/react';
import { createContext, type ReactNode } from 'react';
import {
  beforeEach, expect, test, vi,
} from 'vitest';
import { useRotateTrialAssetIdentifier, useTrialAssetIdentifier, useTrialAssetSegments } from '../useTrialAssetIdentifier';
import { StudyStoreContext, type StudyStore } from '../../store';

const state = vi.hoisted(() => ({
  identifier: 'purchase_0', studyId: 'study-one', globalStoreRevision: 0, enabled: true, requireEntireScreen: false, globalStoreSubmitting: false, globalStorePendingRevision: 0,
}));
vi.mock('../../../routes/utils', () => ({ useCurrentIdentifier: () => state.identifier, useStudyId: () => state.studyId }));
vi.mock('../../store', async () => ({
  StudyStoreContext: (await vi.importActual<{ createContext: typeof createContext }>('react')).createContext(null),
  useStoreSelector: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock('../useStudyConfig', () => ({
  useStudyConfig: () => ({
    globalVariables: state.enabled ? { budget: { initialValue: 100 } } : undefined,
    uiConfig: { requireEntireScreen: state.requireEntireScreen },
  }),
}));

let owner: StudyStore;
const newOwner = () => ({ trialAssetEntry: undefined } as unknown as StudyStore);
const wrapper = (store: StudyStore) => function Wrapper({ children }: { children: ReactNode }) {
  return <StudyStoreContext.Provider value={store}>{children}</StudyStoreContext.Provider>;
};
const mount = (store = owner) => renderHook(useTrialAssetIdentifier, { wrapper: wrapper(store) });

beforeEach(() => {
  window.sessionStorage.clear();
  owner = newOwner();
  Object.assign(state, {
    identifier: 'purchase_0', studyId: 'study-one', globalStoreRevision: 0, enabled: true, requireEntireScreen: false, globalStoreSubmitting: false, globalStorePendingRevision: 0,
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

test('whole-screen recordings get a fresh stable asset key per page visit without global variables', () => {
  state.enabled = false;
  state.requireEntireScreen = true;
  const recorder = mount();
  const currentVisitKey = recorder.result.current;
  expect(currentVisitKey).toMatch(/^purchase_0__screen_/);
  const submitter = mount();
  expect(submitter.result.current).toBe(currentVisitKey);

  const key = 'revisit-recording-asset:study-one:anonymous:purchase_0';
  window.sessionStorage.setItem(key, JSON.stringify({ lifecycleId: 'previous-page', key: currentVisitKey }));
  const reloadedVisit = mount(newOwner());
  expect(reloadedVisit.result.current).toMatch(/^purchase_0__screen_/);
  expect(reloadedVisit.result.current).not.toBe(currentVisitKey);
});

test('whole-screen reload retains the previous asset key in the segment list', () => {
  state.enabled = false;
  state.requireEntireScreen = true;
  const firstVisit = mount();
  const previousKey = firstVisit.result.current;
  window.sessionStorage.setItem('revisit-recording-asset:study-one:anonymous:purchase_0', JSON.stringify({
    lifecycleId: 'previous-page', key: previousKey, segments: [previousKey],
  }));

  const resumed = renderHook(useTrialAssetSegments, { wrapper: wrapper(newOwner()) });
  expect(resumed.result.current).toHaveLength(2);
  expect(resumed.result.current).toContain(previousKey);
  expect(resumed.result.current[1]).not.toBe(previousKey);
});

test('whole-screen checkpoints do not cross study boundaries when participant and task identifiers match', () => {
  state.enabled = false;
  state.requireEntireScreen = true;
  const firstStudy = mount();
  const firstStudyKey = firstStudy.result.current;
  window.sessionStorage.setItem('revisit-recording-asset:study-one:anonymous:purchase_0', JSON.stringify({
    key: firstStudyKey,
    segments: [firstStudyKey],
  }));

  state.studyId = 'study-two';
  const secondStudy = mount();

  expect(secondStudy.result.current).not.toBe(firstStudyKey);
  expect(secondStudy.result.current).not.toContain(firstStudyKey);
  expect(secondStudy.result.current).toMatch(/^purchase_0__screen_/);
});

test('rotating a whole-screen recorder key retains the interrupted segment', () => {
  state.enabled = false;
  state.requireEntireScreen = true;
  const hook = renderHook(() => ({ key: useTrialAssetIdentifier(), segments: useTrialAssetSegments(), rotate: useRotateTrialAssetIdentifier() }), { wrapper: wrapper(owner) });
  const previousKey = hook.result.current.key;
  let nextKey = '';
  act(() => { nextKey = hook.result.current.rotate() ?? ''; hook.rerender(); });
  expect(nextKey).not.toBe(previousKey);
  expect(hook.result.current.key).toBe(nextKey);
  expect(hook.result.current.segments).toEqual([previousKey, nextKey]);
});

test('revisiting an unfinished whole-screen task allocates a new segment', () => {
  state.enabled = false;
  state.requireEntireScreen = true;
  const hook = renderHook(() => ({ key: useTrialAssetIdentifier(), segments: useTrialAssetSegments() }), { wrapper: wrapper(owner) });
  const firstVisitKey = hook.result.current.key;
  act(() => { state.identifier = 'other_1'; hook.rerender(); });
  act(() => { state.identifier = 'purchase_0'; hook.rerender(); });
  expect(hook.result.current.key).not.toBe(firstVisitKey);
  expect(hook.result.current.segments).toContain(firstVisitKey);
});

test('recreating the study store in the same page allocates a fresh unfinished-task segment', () => {
  state.enabled = false;
  state.requireEntireScreen = true;
  const firstStore = renderHook(() => ({ key: useTrialAssetIdentifier(), segments: useTrialAssetSegments() }), { wrapper: wrapper(newOwner()) });
  const earlierKey = firstStore.result.current.key;
  const recreatedStore = renderHook(() => ({ key: useTrialAssetIdentifier(), segments: useTrialAssetSegments() }), { wrapper: wrapper(newOwner()) });
  expect(recreatedStore.result.current.key).not.toBe(earlierKey);
  expect(recreatedStore.result.current.segments).toContain(earlierKey);
  expect(recreatedStore.result.current.segments).toContain(recreatedStore.result.current.key);
});
