import { ParticipantData } from '../../../storage/types';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';
import {
  ComponentData, OverviewData, ParticipantCounts, ResponseData,
} from '../../types';
import { Response, StudyConfig } from '../../../parser/types';
import { componentAnswersAreCorrect } from '../../../utils/correctAnswer';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';

function filterParticipantsByComponent(visibleParticipants: ParticipantData[], componentName?: string): ParticipantData[] {
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
  const filteredParticipants = filterParticipantsByComponent(visibleParticipants, componentName).filter((p) => !p.rejected);

  filteredParticipants.forEach((participant) => {
    // Filter out answers that are not completed or in progress
    const answers = Object.values(participant.answers).filter((answer) => answer.startTime > 0 && answer.endTime !== -1);
    if (answers.length === 0) return { startDate: null, endDate: null };
    return { startDate: new Date(answers[0].startTime), endDate: new Date(answers[answers.length - 1].endTime) };
  });

  return { startDate: null, endDate: null };
}

function calculateTimeStats(visibleParticipants: ParticipantData[], componentName?: string): { avgTime: number; avgCleanTime: number } {
  // Filter out rejected participants and filter by component if provided
  const filteredParticipants = filterParticipantsByComponent(visibleParticipants, componentName).filter((p) => !p.rejected);

  let totalTimeSum = 0;
  let cleanTimeSum = 0;
  let count = 0;
  let cleanCount = 0;

  filteredParticipants.forEach((participant) => {
    const answers = Object.values(participant.answers).filter((answer) => answer.startTime > 0 && answer.endTime !== -1);
    if (answers.length === 0) return;
    totalTimeSum += answers.reduce((sum, answer) => sum + (answer.endTime - answer.startTime) / 1000, 0);
    // add an if statement to check if the cleaned duration is not undefined?
    cleanTimeSum += answers.reduce((sum, answer) => sum + (getCleanedDuration(answer) || 0) / 1000, 0);
    count += answers.length;
    cleanCount += answers.filter((answer) => getCleanedDuration(answer)).length;
  });

  return {
    avgTime: count > 0 ? totalTimeSum / count : NaN,
    avgCleanTime: cleanCount > 0 ? cleanTimeSum / cleanCount : NaN,
  };
}

function calculateCorrectnessStats(visibleParticipants: ParticipantData[], componentName?: string): number {
  // Filter out rejected participants and filter by component if provided
  const validParticipants = filterParticipantsByComponent(visibleParticipants, componentName).filter((p) => !p.rejected);
  const hasCorrectAnswer = validParticipants.some((participant) => Object.values(participant.answers).some((answer) => answer.componentName === componentName && answer.correctAnswer && answer.correctAnswer.length > 0));

  let totalQuestions = 0;
  const correctness = validParticipants.reduce((acc, participant) => {
    const answers = Object.values(participant.answers)
      .filter((answer) => answer.correctAnswer && answer.correctAnswer.length > 0);

    if (answers.length > 0) {
      answers.forEach((answer) => {
        totalQuestions += answer.correctAnswer.length;
        const isCorrect = componentAnswersAreCorrect(answer.answer, answer.correctAnswer);
        if (isCorrect) {
          acc.correctSum += answer.correctAnswer.length;
        }
      });
    }
    return acc;
  }, { correctSum: 0 });
  return hasCorrectAnswer ? (correctness.correctSum / totalQuestions) * 100 : NaN;
}

function calculateResponseStats(visibleParticipants: ParticipantData[]) {
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);
  const stats: Record<string, { name: string; correctness: number; participantCount: number }> = {};

  validParticipants.forEach((participant) => {
    Object.entries(participant.answers).forEach(([, answer]) => {
      const component = answer.componentName;

      if (!stats[component]) {
        stats[component] = {
          name: component,
          correctness: 0,
          participantCount: 0,
        };
      }

      // In‑progress answers are not included in the stats
      if (answer.endTime === -1) {
        return;
      }

      const stat = stats[component];
      stat.participantCount += 1;

      if (answer.correctAnswer && answer.correctAnswer.length > 0) {
        const isCorrect = componentAnswersAreCorrect(answer.answer, answer.correctAnswer);
        stat.correctness += isCorrect ? 1 : 0;
      }
    });
  });

  return Object.values(stats).map((stat) => {
    const hasCorrectAnswers = validParticipants.some((participant) => Object.values(participant.answers).some(
      (answer) => answer.componentName === stat.name
          && answer.correctAnswer
          && answer.correctAnswer.length > 0,
    ));

    return {
      ...stat,
      correctness: hasCorrectAnswers
        ? (stat.correctness / stat.participantCount) * 100
        : NaN,
    };
  });
}

export function getResponseOptions(response: Response): string {
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
    startDate: calculateDateStats(visibleParticipants).startDate,
    endDate: calculateDateStats(visibleParticipants).endDate,
    avgTime: calculateTimeStats(visibleParticipants).avgTime,
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
    const participantCounts = calculateParticipantCounts(validParticipants, name);
    const timeStats = calculateTimeStats(validParticipants, name);
    const correctness = calculateCorrectnessStats(validParticipants, name);

    return {
      component: name,
      participants: participantCounts.total,
      avgTime: timeStats.avgTime,
      avgCleanTime: timeStats.avgCleanTime,
      correctness,
    };
  });
}

export function getResponseStats(visibleParticipants: ParticipantData[], studyConfig: StudyConfig): ResponseData[] {
  const stats = calculateResponseStats(visibleParticipants);
  const data: ResponseData[] = [];

  stats.forEach((stat) => {
    const component = studyConfig.components[stat.name];
    if (!component) return;

    const responses = studyComponentToIndividualComponent(component, studyConfig).response;
    if (responses.length === 0) return;

    responses.forEach((response) => {
      data.push({
        component: stat.name,
        type: response.type,
        question: response.prompt || '',
        options: getResponseOptions(response),
        correctness: Number.isNaN(stat.correctness) ? NaN : stat.correctness,
      });
    });
  });

  return data;
}
