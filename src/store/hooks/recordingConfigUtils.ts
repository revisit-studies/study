import { StudyConfig } from '../../parser/types';

export function getStudyRecordingConfig(
  sequenceComponentIds: string[],
  studyConfig: StudyConfig,
) {
  const { recordScreen, recordAudio, recordWebcam } = studyConfig.uiConfig;

  return {
    studyHasScreenRecording: recordScreen || sequenceComponentIds.some((comp) => studyConfig.components[comp]?.recordScreen),
    studyHasAudioRecording: recordAudio || sequenceComponentIds.some((comp) => studyConfig.components[comp]?.recordAudio),
    studyHasWebcamRecording: recordWebcam || sequenceComponentIds.some((comp) => studyConfig.components[comp]?.recordWebcam),
  };
}
