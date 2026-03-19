import { useMemo } from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useFlatSequence } from '../store';
import { useCurrentComponent } from '../../routes/utils';
import { getStudyRecordingConfig } from './recordingConfigUtils';

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

  const {
    studyHasScreenRecording,
    studyHasAudioRecording,
    studyHasWebcamRecording,
  } = useMemo(
    () => getStudyRecordingConfig(participantSequence, studyConfig),
    [participantSequence, studyConfig],
  );

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
