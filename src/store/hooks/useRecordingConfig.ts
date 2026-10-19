import { useMemo } from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useCurrentComponent } from '../../routes/utils';
import { useStoreSelector } from '../store';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';
import { getStudyRecordings } from '../../utils/useStudyRecordings';
import type { Sequence } from '../types';

function getAssignedComponentNames(
  participantSequence: Sequence,
  funcSequence: Record<string, string[]>,
) {
  const componentNames = new Set(getSequenceFlatMap(participantSequence));

  const collectDynamicComponents = (sequence: Sequence) => {
    sequence.components.forEach((component) => {
      if (typeof component === 'string') {
        return;
      }

      if (component.order === 'dynamic') {
        if (component.id) {
          funcSequence[component.id]?.forEach((componentName) => componentNames.add(componentName));
        }
        return;
      }

      collectDynamicComponents(component);
    });
  };

  collectDynamicComponents(participantSequence);
  return Array.from(componentNames);
}

export function useRecordingConfig() {
  const studyConfig = useStudyConfig();
  const participantSequence = useStoreSelector((state) => state.sequence);
  const funcSequence = useStoreSelector((state) => state.funcSequence);
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
  } = useMemo(() => getStudyRecordings(
    studyConfig,
    getAssignedComponentNames(participantSequence, funcSequence),
  ), [funcSequence, participantSequence, studyConfig]);

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
