import { ParticipantData } from '../../../storage/types';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';
import {
  ComponentData, OverviewData, ParticipantCounts, ResponseData,
} from '../../types';
import { Response, StudyConfig } from '../../../parser/types';
import { componentAnswersAreCorrect } from '../../../utils/correctAnswer';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';

export function filterParticipants(visibleParticipants: ParticipantData[], componentName?: string): ParticipantData[] {
  if (!componentName) {
    return visibleParticipants;
  }

  return visibleParticipants.filter((p) => Object.values(p.answers).some((a) => a.componentName === componentName && a.startTime > 0 && a.endTime !== -1));
}

function calculateParticipantCounts(visibleParticipants: ParticipantData[], componentName?: string): ParticipantCounts {
  // Filter by component if provided
  const filteredParticipants = filterParticipants(visibleParticipants, componentName);

  const participantCounts: ParticipantCounts = {
    total: filteredParticipants.length,
    completed: filteredParticipants.filter((p) => p.completed && !p.rejected).length,
    inProgress: filteredParticipants.filter((p) => !p.completed && !p.rejected).length,
    rejected: filteredParticipants.filter((p) => p.rejected).length,
  };

  return participantCounts;
}

// Checks if the current participant count is different from the calculated participant count
export function hasMismatch(current: number, calculated: number): boolean {
  // TO DO: Implement mismatch calculation
  return current !== calculated;
}

function calculateDateStats(visibleParticipants: ParticipantData[], componentName?: string): { startDate: Date | null; endDate: Date | null } {
  // Filter out rejected participants and filter by component if provided
  const filteredParticipants = filterParticipants(visibleParticipants, componentName).filter((p) => !p.rejected);
  const answers = filteredParticipants
    .flatMap((participant) => Object.values(participant.answers))
    .sort((a, b) => a.startTime - b.startTime);

  if (!answers.length) {
    return { startDate: null, endDate: null };
  }

  return {
    startDate: new Date(answers[0].startTime),
    endDate: new Date(answers[answers.length - 1].endTime),
  };
}

function calculateTimeStats(visibleParticipants: ParticipantData[], componentName?: string): { avgTime: number; avgCleanTime: number } {
  // Filter out rejected participants and filter by component if provided
  const filteredParticipants = filterParticipants(visibleParticipants, componentName).filter((p) => !p.rejected);
  const answers = filteredParticipants
    .flatMap((participant) => Object.values(participant.answers))
    .filter((answer) => answer.startTime > 0 && answer.endTime !== -1);

  if (!answers.length) {
    return { avgTime: NaN, avgCleanTime: NaN };
  }

  let totalTimeSum = 0;
  let cleanTimeSum = 0;
  let count = 0;
  let cleanCount = 0;

  answers.forEach((answer) => {
    const durationSeconds = (answer.endTime - answer.startTime) / 1000;
    totalTimeSum += durationSeconds;
    count += 1;

    const cleaned = getCleanedDuration(answer);
    if (cleaned !== undefined) {
      cleanTimeSum += cleaned / 1000;
      cleanCount += 1;
    }
  });

  return {
    avgTime: count > 0 ? totalTimeSum / count : NaN,
    avgCleanTime: cleanCount > 0 ? cleanTimeSum / cleanCount : NaN,
  };
}

function calculateCorrectnessStats(visibleParticipants: ParticipantData[], componentName?: string): number {
  // Filter out rejected participants and filter by component if provided
  const filteredParticipants = filterParticipants(visibleParticipants, componentName).filter((p) => !p.rejected);
  const answers = filteredParticipants
    .flatMap((participant) => Object.values(participant.answers))
    .filter((answer) => (!componentName || answer.componentName === componentName));

  const hasCorrectAnswer = answers.some((answer) => answer.correctAnswer && answer.correctAnswer.length > 0);
  if (!hasCorrectAnswer) {
    return NaN;
  }

  let totalQuestions = 0;
  let correctSum = 0;

  answers.forEach((answer) => {
    const correctCount = answer.correctAnswer.length;
    if (!correctCount) return;

    totalQuestions += correctCount;
    const isCorrect = componentAnswersAreCorrect(answer.answer, answer.correctAnswer);
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
    return response.options.join(', ');
  }
  // Matrix Radio, Matrix Checkbox
  // example: Questions: Question 1, Question 2, Question 3
  // example: Answers: Answer 1, Answer 2, Answer 3
  if ('answerOptions' in response && 'questionOptions' in response) {
    return `Questions: ${response.questionOptions.join(', ')} \n Answers: ${Array.isArray(response.answerOptions) ? response.answerOptions.join(', ') : response.answerOptions}`;
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

export function getOverviewStats(visibleParticipants: ParticipantData[], componentName?: string): OverviewData {
  return {
    participantCounts: calculateParticipantCounts(visibleParticipants, componentName),
    startDate: calculateDateStats(visibleParticipants, componentName).startDate,
    endDate: calculateDateStats(visibleParticipants, componentName).endDate,
    avgTime: calculateTimeStats(visibleParticipants, componentName).avgTime,
    avgCleanTime: calculateTimeStats(visibleParticipants, componentName).avgCleanTime,
    correctness: calculateCorrectnessStats(visibleParticipants, componentName),
  };
}

export function getComponentStats(visibleParticipants: ParticipantData[]): ComponentData[] {
  const componentNames = new Set<string>();
  visibleParticipants.forEach((participant) => {
    Object.values(participant.answers).forEach((answer) => {
      if (answer.componentName) {
        componentNames.add(answer.componentName);
      }
    });
  });

  // For each component, reuse the existing helper functions to compute stats
  return Array.from(componentNames).map((name) => {
  // Filter out rejected participants and filter by component if provided
    const filteredParticipants = filterParticipants(visibleParticipants, name).filter((p) => !p.rejected);

    const timeStats = calculateTimeStats(visibleParticipants, name);
    const correctness = calculateCorrectnessStats(visibleParticipants, name);

    return {
      component: name,
      participants: filteredParticipants.length,
      avgTime: timeStats.avgTime,
      avgCleanTime: timeStats.avgCleanTime,
      correctness,
    };
  });
}

export function getResponseStats(visibleParticipants: ParticipantData[], studyConfig: StudyConfig): ResponseData[] {
  const data: ResponseData[] = [];

  Object.entries(studyConfig.components).forEach(([name, componentConfig]) => {
    const correctness = calculateCorrectnessStats(visibleParticipants, name);

    const individual = studyComponentToIndividualComponent(componentConfig, studyConfig);
    const responses = individual.response ?? [];
    if (responses.length === 0) return;

    responses.forEach((response) => {
      const responseStat: ResponseData = {
        component: name,
        type: response.type,
        question: response.prompt ?? 'N/A',
        options: getResponseOptions(response),
        correctness,
      };

      data.push(responseStat);
    });
  });

  return data;
}
