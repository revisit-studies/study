import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StudyStyle } from '../../storage/engines/types';

export function useStoredStudyStyle(studyId: string) {
  const { storageEngine } = useStorageEngine();
  const generation = useRef(0);
  const [selection, setSelection] = useState<{ studyId: string; style: StudyStyle } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const studyStyle = selection?.studyId === studyId ? selection.style : null;

  useEffect(() => {
    generation.current += 1;
    const request = generation.current;
    setSelection(null);
    setIsSaving(false);
    setError(null);

    if (storageEngine && studyId) {
      storageEngine.getStudyStyle(studyId).then((style) => {
        if (generation.current === request) setSelection({ studyId, style });
      }).catch((loadError) => {
        console.error('Failed to load study style:', loadError);
        if (generation.current === request) {
          setSelection({ studyId, style: 'default' });
          setError('Could not load study style. Using the default style.');
        }
      });
    }

    return () => { generation.current += 1; };
  }, [storageEngine, studyId]);

  const updateStudyStyle = useCallback(async (style: StudyStyle) => {
    if (!storageEngine || studyStyle === null || isSaving || studyStyle === style) return;

    const request = generation.current;
    const previousStyle = studyStyle;
    setSelection({ studyId, style });
    setIsSaving(true);
    setError(null);

    try {
      await storageEngine.setStudyStyle(studyId, style);
    } catch (saveError) {
      console.error('Failed to save study style:', saveError);
      if (generation.current === request) {
        setSelection({ studyId, style: previousStyle });
        setError('Could not save study style. Please try again.');
      }
    } finally {
      if (generation.current === request) setIsSaving(false);
    }
  }, [storageEngine, studyId, studyStyle, isSaving]);

  return {
    studyStyle, updateStudyStyle, isSaving, error,
  };
}
