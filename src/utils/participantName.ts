import { ParticipantData, StudyConfig } from '../parser/types';

export function participantName(participantData: ParticipantData, studyConfig?: StudyConfig) {
  if (!participantData) {
    return null;
  }

  if (studyConfig?.uiConfig && studyConfig.uiConfig.participantNameField) {
    const [task, response] = studyConfig.uiConfig.participantNameField.split('.');
    const fullTaskName = Object.keys(participantData.answers).find((a) => a.startsWith(task));

    if (fullTaskName) {
      return `${participantData.answers[fullTaskName].answer[response]}`;
    }
  }
  return null;
}
