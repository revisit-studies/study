import { ParticipantData } from '../../../storage/types';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';
import {
  ComponentData, OverviewData, ParticipantCounts, ResponseData,
} from '../../types';
import { Response, StudyConfig } from '../../../parser/types';
import { componentAnswersAreCorrect } from '../../../utils/correctAnswer';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';

export function convertNumberToString(number: number | Date, type: 'date' | 'time' | 'correctness'): string {
  if (type === 'date') {
    if (number instanceof Date && number.getTime() === new Date(0).getTime()) {
      return 'N/A';
    }
    return Number.isNaN(number) ? 'N/A' : new Date(number as number).toLocaleDateString();
  }
  if (type === 'time') {
    return Number.isNaN(number) ? 'N/A' : `${(number as number).toFixed(1)}s`;
  } if (type === 'correctness') {
    return Number.isNaN(number) ? 'N/A' : `${(number as number).toFixed(1)}%`;
  }
  return 'N/A';
}

export function filterParticipantsByComponent(visibleParticipants: ParticipantData[], componentName?: string): ParticipantData[] {
  if (!componentName) {
    return visibleParticipants;
  }
  return visibleParticipants.filter((p) => Object.values(p.answers).some((a) => a.componentName === componentName));
}

function calculateParticipantCounts(visibleParticipants: ParticipantData[], componentName?: string): ParticipantCounts {
  // Filter by component if provided
  const filteredParticipants = filterParticipantsByComponent(visibleParticipants, componentName);

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
  const filteredParticipants = filterParticipantsByComponent(visibleParticipants, componentName);

  const answers = filteredParticipants.flatMap((participant) => Object.values(participant.answers)).filter((answer) => answer.startTime);

  if (answers.length === 0) {
    return { startDate: null, endDate: null };
  }

  return { startDate: new Date(Math.min(...answers.map((answer) => answer.startTime))), endDate: new Date(Math.max(...answers.map((answer) => answer.endTime))) };
}

function calculateTimeStats(visibleParticipants: ParticipantData[], componentName?: string): { avgTime: number; avgCleanTime: number } {
  // Filter out rejected participants and filter by component if provided
  const filteredParticipants = filterParticipantsByComponent(visibleParticipants, componentName);

  let totalTimeSum = 0;
  let cleanTimeSum = 0;
  let count = 0;
  let cleanCount = 0;

  const answers = filteredParticipants.flatMap((participant) => Object.values(participant.answers)).filter((answer) => answer.startTime);

  if (answers.length === 0) {
    return { avgTime: NaN, avgCleanTime: NaN };
  }

  totalTimeSum += answers.reduce((sum, answer) => sum + (answer.endTime - answer.startTime) / 1000, 0);
  cleanTimeSum += answers.reduce((sum, answer) => sum + (getCleanedDuration(answer) || 0) / 1000, 0);
  count += answers.length;
  cleanCount += answers.filter((answer) => getCleanedDuration(answer) !== undefined).length;

  return {
    avgTime: count > 0 ? totalTimeSum / count : NaN,
    avgCleanTime: cleanCount > 0 ? cleanTimeSum / cleanCount : NaN,
  };
}

function calculateCorrectnessStats(visibleParticipants: ParticipantData[], componentName?: string): number {
  // Filter out rejected participants and filter by component if provided
  const validParticipants = filterParticipantsByComponent(visibleParticipants, componentName);

  const hasCorrectAnswer = validParticipants.flatMap((participant) => Object.values(participant.answers)).some((answer) => answer.correctAnswer && answer.correctAnswer.length > 0);

  if (!hasCorrectAnswer) {
    return NaN;
  }

  let totalQuestions = 0;
  const { correctSum } = validParticipants.reduce(
    (acc, participant) => {
      const answers = Object.values(participant.answers).filter((answer) => {
        if (!answer.correctAnswer || answer.correctAnswer.length === 0) return false;
        if (!componentName) return true;
        return answer.componentName === componentName;
      });

      answers.forEach((answer) => {
        totalQuestions += answer.correctAnswer.length;
        const isCorrect = componentAnswersAreCorrect(answer.answer, answer.correctAnswer);
        if (isCorrect) {
          acc.correctSum += answer.correctAnswer.length;
        }
      });

      return acc;
    },
    { correctSum: 0 },
  );

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

export function getOverviewStats(visibleParticipants: ParticipantData[]): OverviewData {
  return {
    participantCounts: calculateParticipantCounts(visibleParticipants),
    startDate: calculateDateStats(visibleParticipants).startDate ?? new Date(0),
    endDate: calculateDateStats(visibleParticipants).endDate ?? new Date(0),
    avgTime: calculateTimeStats(visibleParticipants).avgTime ?? NaN,
    avgCleanTime: calculateTimeStats(visibleParticipants).avgCleanTime,
    correctness: calculateCorrectnessStats(visibleParticipants),
  };
}

export function getComponentStats(visibleParticipants: ParticipantData[]): ComponentData[] {
  // Exclude rejected participants for component‑level stats
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);

  // Collect unique component names from all answers
  const componentNames = new Set<string>();
  validParticipants.forEach((participant) => {
    Object.values(participant.answers).forEach((answer) => {
      if (answer.componentName) {
        componentNames.add(answer.componentName);
      }
    });
  });

  // For each component, reuse the existing helper functions to compute stats
  return Array.from(componentNames).map((name) => {
    const counts = calculateParticipantCounts(validParticipants, name);
    const timeStats = calculateTimeStats(validParticipants, name);
    const correctness = calculateCorrectnessStats(validParticipants, name);

    return {
      component: name,
      participants: counts.total,
      avgTime: timeStats.avgTime,
      avgCleanTime: timeStats.avgCleanTime,
      correctness,
    };
  });
}

export function getResponseStats(visibleParticipants: ParticipantData[], studyConfig: StudyConfig): ResponseData[] {
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);
  const data: ResponseData[] = [];

  Object.entries(studyConfig.components).forEach(([name, componentConfig]) => {
    const correctness = calculateCorrectnessStats(validParticipants, name);
    if (Number.isNaN(correctness)) return;

    const individual = studyComponentToIndividualComponent(componentConfig, studyConfig);
    const responses = individual.response ?? [];
    if (responses.length === 0) return;

    responses.forEach((response) => {
      const responseStat: ResponseData = {
        component: name,
        type: response.type,
        question: response.prompt ?? '',
        options: getResponseOptions(response),
        correctness,
      };

      data.push(responseStat);
    });
  });

  return data;
}
