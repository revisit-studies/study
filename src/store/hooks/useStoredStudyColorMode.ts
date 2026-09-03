import { useMantineColorScheme } from '@mantine/core';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import type { StudyColorMode } from '../../storage/engines/types';
import { useStorageEngine } from '../../storage/storageEngineHooks';

export function useStoredStudyColorMode(studyId: string | null) {
  const { storageEngine } = useStorageEngine();
  const { setColorScheme } = useMantineColorScheme();
  const setColorSchemeRef = useRef(setColorScheme);
  const [studyColorMode, setStudyColorModeState] = useState<StudyColorMode | null>(null);

  useEffect(() => {
    setColorSchemeRef.current = setColorScheme;
  }, [setColorScheme]);

  useEffect(() => {
    let cancelled = false;

    if (!storageEngine || !studyId) {
      return undefined;
    }

    setStudyColorModeState(null);
    storageEngine.getStudyColorMode(studyId).then((colorMode) => {
      if (!cancelled) {
        setStudyColorModeState(colorMode);
        setColorSchemeRef.current(colorMode);
      }
    }).catch((error) => {
      console.error('Failed to load study color mode:', error);
      if (!cancelled) {
        setStudyColorModeState('light');
        setColorSchemeRef.current('light');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [storageEngine, studyId]);

  const updateStudyColorMode = useCallback(async (colorMode: StudyColorMode) => {
    if (!storageEngine || !studyId) {
      return;
    }

    const previousColorMode = studyColorMode ?? 'light';
    setStudyColorModeState(colorMode);
    setColorSchemeRef.current(colorMode);

    try {
      await storageEngine.setStudyColorMode(studyId, colorMode);
    } catch (error) {
      setStudyColorModeState(previousColorMode);
      setColorSchemeRef.current(previousColorMode);
      throw error;
    }
  }, [storageEngine, studyColorMode, studyId]);

  return {
    studyColorMode,
    updateStudyColorMode,
  };
}
