import { useMemo } from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useFlatSequence } from '../store';
import { useCurrentComponent } from '../../routes/utils';

export function useRecordingConfig() {
  const studyConfig = useStudyConfig();
  const participantSequence = useFlatSequence();
  const currentComponent = useCurrentComponent();
  const stepConfig = studyConfig.components[currentComponent];

  const {
    recordScreen,
    recordAudio,
    recordWebcam,
    clickToRecord,
  } = studyConfig.uiConfig;

  const studyHasScreenRecording = useMemo(() => (recordScreen || participantSequence.some((comp) => studyConfig.components[comp]?.recordScreen)), [participantSequence, studyConfig, recordScreen]);

  const studyHasAudioRecording = useMemo(() => (recordAudio || participantSequence.some((comp) => studyConfig.components[comp]?.recordAudio)), [participantSequence, studyConfig, recordAudio]);

  const studyHasWebcamRecording = useMemo(() => (recordWebcam || participantSequence.some((comp) => studyConfig.components[comp]?.recordWebcam)), [participantSequence, studyConfig, recordWebcam]);

  const currentComponentHasScreenRecording = useMemo(
    () => stepConfig?.recordScreen ?? !!recordScreen,
    [recordScreen, stepConfig],
  );

  const currentComponentHasAudioRecording = useMemo(
    () => stepConfig?.recordAudio ?? !!recordAudio,
    [recordAudio, stepConfig],
  );

  const currentComponentHasWebcamRecording = useMemo(
    () => stepConfig?.recordWebcam ?? !!recordWebcam,
    [recordWebcam, stepConfig],
  );

  const currentComponentHasClickToRecord = useMemo(
    () => stepConfig?.clickToRecord ?? !!clickToRecord,
    [clickToRecord, stepConfig],
  );

  return {
    studyHasAudioRecording,
    studyHasScreenRecording,
    studyHasWebcamRecording,
    currentComponentHasAudioRecording,
    currentComponentHasScreenRecording,
    currentComponentHasWebcamRecording,
    currentComponentHasClickToRecord,
  };
}
