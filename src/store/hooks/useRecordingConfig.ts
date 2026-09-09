import { useMemo } from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useCurrentComponent } from '../../routes/utils';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';
import { getStudyRecordings } from '../../utils/useStudyRecordings';

export function useRecordingConfig() {
  const studyConfig = useStudyConfig();
  const currentComponent = useCurrentComponent();
  const stepConfig = studyConfig.components[currentComponent];
  const resolvedStepConfig = stepConfig
    ? studyComponentToIndividualComponent(stepConfig, studyConfig)
    : undefined;

  const {
    recordScreen,
    recordAudio,
    recordWebcam,
    clickToRecord,
  } = studyConfig.uiConfig;

  const {
    hasAudioRecording: studyHasAudioRecording,
    hasScreenRecording: studyHasScreenRecording,
    hasWebcamRecording: studyHasWebcamRecording,
  } = useMemo(() => getStudyRecordings(studyConfig), [studyConfig]);

  const currentComponentHasScreenRecording = useMemo(
    () => resolvedStepConfig?.recordScreen ?? !!recordScreen,
    [recordScreen, resolvedStepConfig],
  );

  const currentComponentHasAudioRecording = useMemo(
    () => resolvedStepConfig?.recordAudio ?? !!recordAudio,
    [recordAudio, resolvedStepConfig],
  );

  const currentComponentHasWebcamRecording = useMemo(
    () => resolvedStepConfig?.recordWebcam ?? !!recordWebcam,
    [recordWebcam, resolvedStepConfig],
  );

  const currentComponentHasClickToRecord = useMemo(
    () => resolvedStepConfig?.clickToRecord ?? !!clickToRecord,
    [clickToRecord, resolvedStepConfig],
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
