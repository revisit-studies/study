import { act, renderHook, waitFor } from '@testing-library/react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { useStoredStudyColorMode } from '../useStoredStudyColorMode';

const colorModeMocks = vi.hoisted(() => {
  const getStudyColorMode = vi.fn();
  const setStudyColorMode = vi.fn();

  return {
    getStudyColorMode,
    setColorScheme: vi.fn(),
    setStudyColorMode,
    storageEngine: {
      getStudyColorMode,
      setStudyColorMode,
    },
  };
});

vi.mock('@mantine/core', () => ({
  useMantineColorScheme: () => ({
    setColorScheme: (colorMode: 'light' | 'dark') => colorModeMocks.setColorScheme(colorMode),
  }),
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: colorModeMocks.storageEngine,
  }),
}));

describe('useStoredStudyColorMode', () => {
  beforeEach(() => {
    colorModeMocks.getStudyColorMode.mockReset().mockResolvedValue('light');
    colorModeMocks.setStudyColorMode.mockReset().mockResolvedValue(undefined);
    colorModeMocks.setColorScheme.mockReset();
  });

  test('loads and applies the study color mode', async () => {
    colorModeMocks.getStudyColorMode.mockResolvedValue('dark');

    const { result } = renderHook(() => useStoredStudyColorMode('test-study'));

    await waitFor(() => {
      expect(result.current.studyColorMode).toBe('dark');
    });
    expect(colorModeMocks.getStudyColorMode).toHaveBeenCalledWith('test-study');
    expect(colorModeMocks.getStudyColorMode).toHaveBeenCalledTimes(1);
    expect(colorModeMocks.setColorScheme).toHaveBeenCalledWith('dark');
  });

  test('persists and applies a color mode update', async () => {
    const { result } = renderHook(() => useStoredStudyColorMode('test-study'));

    await waitFor(() => {
      expect(result.current.studyColorMode).toBe('light');
    });

    await act(async () => {
      await result.current.updateStudyColorMode('dark');
    });

    expect(colorModeMocks.setStudyColorMode).toHaveBeenCalledWith('test-study', 'dark');
    expect(colorModeMocks.setColorScheme).toHaveBeenLastCalledWith('dark');
    expect(result.current.studyColorMode).toBe('dark');
  });

  test('restores the previous color mode when saving fails', async () => {
    colorModeMocks.setStudyColorMode.mockRejectedValue(new Error('save failed'));
    const { result } = renderHook(() => useStoredStudyColorMode('test-study'));

    await waitFor(() => {
      expect(result.current.studyColorMode).toBe('light');
    });

    await act(async () => {
      await expect(result.current.updateStudyColorMode('dark')).rejects.toThrow('save failed');
    });

    expect(colorModeMocks.setColorScheme).toHaveBeenLastCalledWith('light');
    expect(result.current.studyColorMode).toBe('light');
  });
});
