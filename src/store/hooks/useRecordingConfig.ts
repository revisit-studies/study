import { useMemo } from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useFlatSequence } from '../store';
import { useCurrentComponent } from '../../routes/utils';

export function useRecordingConfig() {
  const studyConfig = useStudyConfig();
  const participantSequence = useFlatSequence();
  const currentComponent = useCurrentComponent();
  const stepConfig = studyConfig.components[currentComponent];

  const { recordScreen, recordAudio } = studyConfig.uiConfig;

  const studyHasScreenRecording = useMemo(() => (recordScreen || participantSequence.some((comp) => studyConfig.components[comp]?.recordScreen)), [participantSequence, studyConfig, recordScreen]);

  const studyHasAudioRecording = useMemo(() => (recordAudio || participantSequence.some((comp) => studyConfig.components[comp]?.recordAudio)), [participantSequence, studyConfig, recordAudio]);

  const currentComponentHasScreenRecording = useMemo(
    () => stepConfig?.recordScreen ?? !!recordScreen,
    [recordScreen, stepConfig],
  );

  const currentComponentHasAudioRecording = useMemo(
    () => stepConfig?.recordAudio ?? !!recordAudio,
    [recordAudio, stepConfig],
  );

  return {
    studyHasAudioRecording,
    studyHasScreenRecording,
    currentComponentHasAudioRecording,
    currentComponentHasScreenRecording,
  };
}
