import { useEffect, useState } from 'react';
import { StudyConfig } from '../parser/types';
import { studyComponentToIndividualComponent } from './handleComponentInheritance';

export function getStudyRecordings(studyConfig: StudyConfig | undefined) {
  if (!studyConfig?.uiConfig || !studyConfig.components) {
    return {
      hasAudioRecording: false,
      hasScreenRecording: false,
      hasWebcamRecording: false,
    };
  }

  const { recordAudio, recordScreen, recordWebcam } = studyConfig.uiConfig;
  const componentConfig = Object.keys(studyConfig.components).map((componentId) => studyComponentToIndividualComponent(studyConfig.components[componentId], studyConfig));

  return {
    hasAudioRecording: !!recordAudio || componentConfig.some((component) => component.recordAudio),
    hasScreenRecording: !!recordScreen || componentConfig.some((component) => component.recordScreen),
    hasWebcamRecording: !!recordWebcam || componentConfig.some((component) => component.recordWebcam),
  };
}

/**
 * Determines if the study has audio, screen, and webcam recordings.
 */
export function useStudyRecordings(studyConfig: StudyConfig | undefined) {
  const [hasAudioRecording, setHasAudioRecording] = useState(false);
  const [hasScreenRecording, setHasScreenRecording] = useState(false);
  const [hasWebcamRecording, setHasWebcamRecording] = useState(false);

  useEffect(() => {
    const recordings = getStudyRecordings(studyConfig);
    setHasAudioRecording(recordings.hasAudioRecording);
    setHasScreenRecording(recordings.hasScreenRecording);
    setHasWebcamRecording(recordings.hasWebcamRecording);
  }, [studyConfig]);

  return {
    hasAudioRecording,
    hasScreenRecording,
    hasWebcamRecording,
  };
}
