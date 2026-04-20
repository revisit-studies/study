import { ParticipantDataWithStatus } from '../../../storage/types';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';
import {
  ComponentData, OverviewData, ParticipantCounts, ResponseData,
} from '../../types';
import { MatrixResponse, Response, StudyConfig } from '../../../parser/types';
import { componentAnswersAreCorrect } from '../../../utils/correctAnswer';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';
import { getMatrixAnswerOptions } from '../../../utils/responseOptions';

function getParticipantStudyConfig(
  participantConfigHash: string,
  studyConfig?: StudyConfig,
  allConfigs: Record<string, StudyConfig> = {},
) {
  if (!participantConfigHash) {
    return studyConfig;
  }
  const participantStudyConfig = allConfigs[participantConfigHash];
  if (!participantStudyConfig) {
    console.warn(`Missing study config for participant config hash "${participantConfigHash}". Correctness stats should not be computed against the current study config.`);
    return undefined;
  }
  return participantStudyConfig;
}

function filterParticipants(
  visibleParticipants: ParticipantDataWithStatus[],
  componentName?: string,
  excludeRejected?: boolean,
): ParticipantDataWithStatus[] {
  return visibleParticipants.filter((participant) => {
    // Filter out rejected participants if excludeRejected is true
    const isNotRejected = !excludeRejected || !participant.rejected;

    // Filter by component - participant must have an answer for the component and has finished it
    const hasValidComponentAnswer = !componentName || Object.values(participant.answers).some((answer) => answer.componentName === componentName && answer.startTime > 0 && answer.endTime !== -1);

    return isNotRejected && hasValidComponentAnswer;
  });
}

function calculateParticipantCounts(visibleParticipants: ParticipantDataWithStatus[], componentName?: string): ParticipantCounts {
  const filteredParticipants = filterParticipants(visibleParticipants, componentName, false);

  const participantCounts: ParticipantCounts = {
    total: filteredParticipants.length,
    // Include !p.rejected to exclude participants rejected manually after completing the study
    completed: filteredParticipants.filter((p) => p.completed && !p.rejected).length,
    inProgress: filteredParticipants.filter((p) => !p.completed && !p.rejected).length,
    rejected: filteredParticipants.filter((p) => p.rejected).length,
  };

  return participantCounts;
}

function calculateDateStats(visibleParticipants: ParticipantDataWithStatus[], componentName?: string): { startDate: Date | null; endDate: Date | null } {
  // Filter out rejected participants and filter by component if provided
  const filteredParticipants = filterParticipants(visibleParticipants, componentName, true);
  const answers = filteredParticipants
    .flatMap((participant) => Object.values(participant.answers))
    .filter((answer) => answer.endTime !== -1);

  if (!answers.length) {
    return { startDate: null, endDate: null };
  }

  const startTimes = answers.map((answer) => answer.startTime);
  const endTimes = answers.map((answer) => answer.endTime);

  return {
    startDate: new Date(Math.min(...startTimes)),
    endDate: new Date(Math.max(...endTimes)),
  };
}

function calculateTimeStats(visibleParticipants: ParticipantDataWithStatus[], componentName?: string): { avgTime: number; avgCleanTime: number; participantsWithInvalidCleanTimeCount: number } {
  // Time stats use any non-rejected participant who has finished the relevant answer(s).
  const filteredParticipants = filterParticipants(visibleParticipants, componentName, true);

  let participantsWithInvalidCleanTimeCount = 0;
  const time = filteredParticipants.reduce((acc, participant) => {
    let hasInvalidCleanTime = false;
    const timeStats = Object.values(participant.answers)
      .filter((answer) => (!componentName || answer.componentName === componentName) && answer.endTime !== -1)
      .map((answer) => {
        const cleanedDuration = getCleanedDuration(answer as never);
        if (cleanedDuration === -1) {
          hasInvalidCleanTime = true;
        }
        return {
          totalTime: (answer.endTime - answer.startTime) / 1000,
          cleanTime: cleanedDuration >= 0 ? cleanedDuration / 1000 : 0,
        };
      });
    if (timeStats.length > 0) {
      const totalTime = timeStats.reduce((sum, t) => sum + t.totalTime, 0);
      const cleanTime = timeStats.reduce((sum, t) => sum + t.cleanTime, 0);
      const countIncrement = componentName ? timeStats.length : 1;

      // Overview (no componentName) averages total study duration per participant; component view averages per answer.
      acc.count += countIncrement;
      acc.totalTimeSum += totalTime;
      if (!hasInvalidCleanTime) {
        acc.cleanCount += countIncrement;
        acc.cleanTimeSum += cleanTime;
      }
      if (hasInvalidCleanTime) {
        participantsWithInvalidCleanTimeCount += 1;
      }
    }
    return acc;
  }, {
    count: 0,
    cleanCount: 0,
    totalTimeSum: 0,
    cleanTimeSum: 0,
  });

  return {
    avgTime: time.count > 0 ? time.totalTimeSum / time.count : NaN,
    avgCleanTime: time.cleanCount > 0 ? time.cleanTimeSum / time.cleanCount : NaN,
    participantsWithInvalidCleanTimeCount,
  };
}

function calculateCorrectnessStats(
  visibleParticipants: ParticipantDataWithStatus[],
  componentName?: string,
  studyConfig?: StudyConfig,
  allConfigs: Record<string, StudyConfig> = {},
): number {
  // Filter out rejected participants and filter by component if provided
  const filteredParticipants = filterParticipants(visibleParticipants, componentName, true);
  const participantAnswers = filteredParticipants.flatMap((participant) => Object.values(participant.answers)
    .filter((answer) => (!componentName || answer.componentName === componentName))
    .map((answer) => ({ answer, participant })));

  const hasCorrectAnswer = participantAnswers.some(({ answer }) => answer.correctAnswer && answer.correctAnswer.length > 0);
  if (!hasCorrectAnswer) {
    return NaN;
  }

  let totalQuestions = 0;
  let correctSum = 0;

  participantAnswers.forEach(({ answer, participant }) => {
    const correctCount = answer.correctAnswer.length;
    if (!correctCount) return;
    const participantStudyConfig = getParticipantStudyConfig(participant.participantConfigHash, studyConfig, allConfigs);
    const component = participantStudyConfig?.components[answer.componentName]
      ? studyComponentToIndividualComponent(
        participantStudyConfig.components[answer.componentName],
        participantStudyConfig,
      )
      : undefined;

    totalQuestions += correctCount;
    const isCorrect = componentAnswersAreCorrect(answer.answer, answer.correctAnswer, component?.response);
    if (isCorrect) {
      correctSum += correctCount;
    }
  });

  return totalQuestions > 0 ? (correctSum / totalQuestions) * 100 : NaN;
}

function getResponseOptions(response: Response): string {
  // Slider
  // example: Bad (0), Mid (50), Good (100)
  if (response.type === 'slider') {
    return response.options.map((option) => `${option.label} (${option.value})`).join(', ');
  }
  // Dropdown, Checkbox, Radio, Button
  // example: Option 1, Option 2, Option 3
  if ('options' in response) {
    return response.options.map((option) => (typeof option === 'string' ? option : option.label)).join(', ');
  }
  // Matrix Radio, Matrix Checkbox
  // example: Questions: Question 1, Question 2, Question 3
  // example: Answers: Answer 1, Answer 2, Answer 3
  if ('answerOptions' in response && 'questionOptions' in response) {
    const questionOptions = response.questionOptions
      .map((option) => (typeof option === 'string' ? option : option.label))
      .join(', ');
    const answerOptions = response.withDontKnow
      ? getMatrixAnswerOptions(response as MatrixResponse).map((option) => option.label).join(', ')
      : (Array.isArray(response.answerOptions)
        ? response.answerOptions.map((option) => (typeof option === 'string' ? option : option.label)).join(', ')
        : response.answerOptions);
    return `Questions: ${questionOptions} \n Answers: ${answerOptions}`;
  }
  // Likert Scale
  // example: Dislike ~ Like (9 items)
  if ('numItems' in response) {
    return `${response.leftLabel ? ` ${response.leftLabel} ~ ${response.rightLabel}` : ''} (${response.numItems} items)`;
  }
  return 'N/A';
}

export function convertNumberToString(number: number | Date | null, type: 'date' | 'time' | 'correctness'): string {
  if (type === 'date' && number instanceof Date) {
    return number !== null ? number.toLocaleDateString() : 'N/A';
  }
  if (type === 'time' && typeof number === 'number') {
    return Number.isNaN(number) ? 'N/A' : `${number.toFixed(1)}s`;
  }
  if (type === 'correctness' && typeof number === 'number') {
    return Number.isNaN(number) ? 'N/A' : `${number.toFixed(1)}%`;
  }
  return 'N/A';
}

export function getOverviewStats(
  visibleParticipants: ParticipantDataWithStatus[],
  componentName?: string,
  studyConfig?: StudyConfig,
  allConfigs: Record<string, StudyConfig> = {},
): OverviewData {
  const timeStats = calculateTimeStats(visibleParticipants, componentName);
  const dateStats = calculateDateStats(visibleParticipants, componentName);
  const calculatedCounts = calculateParticipantCounts(visibleParticipants, componentName);

  const overviewData: OverviewData = {
    participantCounts: calculatedCounts,
    startDate: dateStats.startDate,
    endDate: dateStats.endDate,
    avgTime: timeStats.avgTime,
    avgCleanTime: timeStats.avgCleanTime,
    participantsWithInvalidCleanTimeCount: timeStats.participantsWithInvalidCleanTimeCount,
    correctness: calculateCorrectnessStats(visibleParticipants, componentName, studyConfig, allConfigs),
  };

  return overviewData;
}

export function getComponentStats(
  visibleParticipants: ParticipantDataWithStatus[],
  studyConfig: StudyConfig,
  allConfigs: Record<string, StudyConfig> = {},
): ComponentData[] {
  // Get all component names from the current study
  const componentNames = Object.keys(studyConfig.components);
  const componentData: ComponentData[] = componentNames.map((name) => {
    const timeStats = calculateTimeStats(visibleParticipants, name);

    return {
      component: name,
      participants: calculateParticipantCounts(visibleParticipants, name).total,
      avgTime: timeStats.avgTime,
      avgCleanTime: timeStats.avgCleanTime,
      correctness: calculateCorrectnessStats(visibleParticipants, name, studyConfig, allConfigs),
    };
  });

  return componentData;
}

export function getResponseStats(
  visibleParticipants: ParticipantDataWithStatus[],
  studyConfig: StudyConfig,
  allConfigs: Record<string, StudyConfig> = {},
): ResponseData[] {
  // Get all responses for each component
  const responseData: ResponseData[] = Object.entries(studyConfig.components).flatMap(([name, componentConfig]) => {
    const component = studyComponentToIndividualComponent(componentConfig, studyConfig);
    const responses = component.response ?? [];
    if (responses.length === 0) return [];
    const correctness = calculateCorrectnessStats(visibleParticipants, name, studyConfig, allConfigs);

    return responses.map((response) => ({
      component: name,
      type: response.type,
      question: response.prompt ?? 'N/A',
      options: getResponseOptions(response),
      correctness,
    }));
  });

  return responseData;
}
