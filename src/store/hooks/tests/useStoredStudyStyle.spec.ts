import {
  act, cleanup, renderHook, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { useStoredStudyStyle } from '../useStoredStudyStyle';
import { StudyStyle } from '../../../storage/engines/types';

const storage = vi.hoisted(() => ({
  getStudyStyle: vi.fn(),
  setStudyStyle: vi.fn(),
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: storage }),
}));

beforeEach(() => {
  storage.getStudyStyle.mockReset().mockResolvedValue('default');
  storage.setStudyStyle.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('loads the study preference, saves style selections, and reloads the saved preference', async () => {
  let stored: StudyStyle = 'default';
  storage.getStudyStyle.mockImplementation(async () => stored);
  storage.setStudyStyle.mockImplementation(async (_studyId, style: StudyStyle) => { stored = style; });
  const first = renderHook(() => useStoredStudyStyle('study-a'));
  expect(first.result.current.studyStyle).toBeNull();
  await waitFor(() => expect(first.result.current.studyStyle).toBe('default'));
  await act(async () => { await first.result.current.updateStudyStyle('formLayout'); });
  expect(storage.setStudyStyle).toHaveBeenCalledWith('study-a', 'formLayout');
  first.unmount();
  const second = renderHook(() => useStoredStudyStyle('study-a'));
  await waitFor(() => expect(second.result.current.studyStyle).toBe('formLayout'));
  await act(async () => { await second.result.current.updateStudyStyle('default'); });
  expect(stored).toBe('default');
});

test('falls back to the default layout and reports a load failure', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  storage.getStudyStyle.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useStoredStudyStyle('study-a'));
  await waitFor(() => expect(result.current.studyStyle).toBe('default'));
  expect(result.current.error).toContain('Could not load');
});

test('rolls back failed saves and clears the saving state', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  storage.setStudyStyle.mockRejectedValue(new Error('denied'));
  const { result } = renderHook(() => useStoredStudyStyle('study-a'));
  await waitFor(() => expect(result.current.studyStyle).toBe('default'));
  await act(async () => { await result.current.updateStudyStyle('formLayout'); });
  expect(result.current.studyStyle).toBe('default');
  expect(result.current.isSaving).toBe(false);
  expect(result.current.error).toContain('Could not save');
});

test('ignores a previous study load after navigation', async () => {
  let resolveA!: (style: StudyStyle) => void;
  storage.getStudyStyle.mockImplementation((studyId) => (studyId === 'study-a'
    ? new Promise<StudyStyle>((resolve) => { resolveA = resolve; }) : Promise.resolve('default')));
  const { result, rerender } = renderHook(({ studyId }) => useStoredStudyStyle(studyId), {
    initialProps: { studyId: 'study-a' },
  });
  rerender({ studyId: 'study-b' });
  await waitFor(() => expect(result.current.studyStyle).toBe('default'));
  await act(async () => { resolveA('formLayout'); });
  expect(result.current.studyStyle).toBe('default');
});

test('a previous study save failure cannot roll back the next study', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let rejectSave!: (error: Error) => void;
  storage.setStudyStyle.mockImplementation(() => new Promise<void>((resolve, reject) => { rejectSave = reject; }));
  const { result, rerender } = renderHook(({ studyId }) => useStoredStudyStyle(studyId), {
    initialProps: { studyId: 'study-a' },
  });
  await waitFor(() => expect(result.current.studyStyle).toBe('default'));
  let save!: Promise<void>;
  act(() => { save = result.current.updateStudyStyle('formLayout'); });
  expect(result.current.isSaving).toBe(true);
  storage.getStudyStyle.mockResolvedValue('formLayout');
  rerender({ studyId: 'study-b' });
  await waitFor(() => expect(result.current.studyStyle).toBe('formLayout'));
  await act(async () => {
    rejectSave(new Error('offline'));
    await save;
  });
  expect(result.current.studyStyle).toBe('formLayout');
  expect(result.current.error).toBeNull();
});
