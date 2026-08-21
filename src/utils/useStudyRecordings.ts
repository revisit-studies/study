import { useEffect, useState } from 'react';
import { StudyConfig } from '../parser/types';
import { studyComponentToIndividualComponent } from './handleComponentInheritance';

/**
 * Determines if the study has audio and screen recordings.
 */
export function useStudyRecordings(studyConfig: StudyConfig | undefined) {
  const [hasAudioRecording, setHasAudioRecording] = useState(false);
  const [hasScreenRecording, setHasScreenRecording] = useState(false);

  useEffect(() => {
    if (!studyConfig) {
      setHasAudioRecording(false);
      setHasScreenRecording(false);
      return;
    }

    const { recordAudio, recordScreen } = studyConfig.uiConfig;

    const componentConfig = Object.keys(studyConfig.components).map((componentId) => studyComponentToIndividualComponent(studyConfig.components[componentId], studyConfig));

    setHasAudioRecording(recordAudio || componentConfig.some((a) => a.recordAudio));
    setHasScreenRecording(recordScreen || componentConfig.some((a) => a.recordScreen));
  }, [studyConfig]);

  return {
    hasAudioRecording,
    hasScreenRecording,
  };
}
