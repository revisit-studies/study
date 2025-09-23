import { ParticipantData } from '../../../storage/types';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';
import { ParticipantCounts } from '../../types';
import { Response } from '../../../parser/types';
import { StorageEngine } from '../../../storage/engines/types';
import { componentAnswersAreCorrect } from '../../../utils/correctAnswer';

export function calculateParticipantCounts(visibleParticipants: ParticipantData[]): ParticipantCounts {
  return {
    total: visibleParticipants.length,
    // Include !p.rejected to exclude participants rejected manually after completing the study
    completed: visibleParticipants.filter((p) => p.completed && !p.rejected).length,
    inProgress: visibleParticipants.filter((p) => !p.completed && !p.rejected).length,
    rejected: visibleParticipants.filter((p) => p.rejected).length,
  };
}

export function calculateDateStats(visibleParticipants: ParticipantData[]): { startDate: Date | null; endDate: Date | null } {
  // Filter out rejected participants
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);
  const dates = validParticipants.map((participant) => {
    const answers = Object.values(participant.answers)
      .filter((data) => data.startTime)
      .sort((a, b) => a.startTime - b.startTime);
    return {
      startTime: answers.length > 0 ? answers[0].startTime : undefined,
      endTime: answers.length > 0 ? answers[answers.length - 1].endTime : undefined,
    };
  });
  const startTimes = dates.map((d) => d.startTime).filter((t): t is number => t != null);
  const endTimes = dates.map((d) => d.endTime).filter((t): t is number => t != null);
  return {
    startDate: startTimes.length > 0 ? new Date(Math.min(...startTimes)) : null,
    endDate: endTimes.length > 0 ? new Date(Math.max(...endTimes)) : null,
  };
}

export function calculateTimeStats(visibleParticipants: ParticipantData[]): { avgTime: number; avgCleanTime: number } {
  // Filter out rejected participants
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);
  const time = validParticipants.reduce((acc, participant) => {
    const timeStats = Object.values(participant.answers)
      .filter((answer) => answer.endTime !== -1)
      .map((answer) => ({
        totalTime: (answer.endTime - answer.startTime) / 1000,
        cleanTime: (() => {
          const cleanedDuration = getCleanedDuration(answer as never);
          return cleanedDuration ? cleanedDuration / 1000 : 0;
        })(),
      }));
    if (timeStats.length > 0) {
      acc.count += timeStats.length;
      acc.totalTimeSum += timeStats.reduce((sum, t) => sum + t.totalTime, 0);
      acc.cleanTimeSum += timeStats.reduce((sum, t) => sum + t.cleanTime, 0);
    }
    return acc;
  }, { totalTimeSum: 0, cleanTimeSum: 0, count: 0 });

  return {
    avgTime: time.count > 0 ? time.totalTimeSum / time.count : NaN,
    avgCleanTime: time.count > 0 ? time.cleanTimeSum / time.count : NaN,
  };
}

export function calculateCorrectnessStats(visibleParticipants: ParticipantData[]): number {
  // Filter out rejected participants
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);
  const hasCorrectAnswer = validParticipants.some((participant) => Object.values(participant.answers).some((answer) => answer.correctAnswer && answer.correctAnswer.length > 0));

  let totalQuestions = 0;
  const correctness = validParticipants.reduce((acc, participant) => {
    const answers = Object.values(participant.answers)
      .filter((answer) => answer.correctAnswer && answer.correctAnswer.length > 0);

    if (answers.length > 0) {
      answers.forEach((answer) => {
        totalQuestions += answer.correctAnswer.length;
        const isCorrect = answer.correctAnswer.every((correctAnswer) => {
          const participantAnswer = answer.answer[correctAnswer.id];
          return correctAnswer.answer === participantAnswer;
        });
        if (isCorrect) {
          acc.correctSum += answer.correctAnswer.length;
        }
      });
    }
    return acc;
  }, { correctSum: 0 });
  return hasCorrectAnswer ? (correctness.correctSum / totalQuestions) * 100 : NaN;
}

export function calculateComponentStats(visibleParticipants: ParticipantData[]) {
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);
  const stats: Record<string, {
    name: string;
    avgTime: number;
    avgCleanTime: number;
    participantCount: number;
    correctness: number;
  }> = {};

  validParticipants.forEach((participant) => {
    const components = new Set<string>();
    Object.entries(participant.answers).forEach(([taskId, answer]) => {
      const component = `${taskId.split('_')[0]}`;

      if (!stats[component]) {
        stats[component] = {
          name: component,
          avgTime: 0,
          avgCleanTime: 0,
          participantCount: 0,
          correctness: 0,
        };
      }
      if (answer.endTime === -1) {
        return;
      }
      const stat = stats[component];
      const time = (answer.endTime - answer.startTime) / 1000;
      const cleanedDuration = getCleanedDuration(answer as never);
      const cleanTime = cleanedDuration ? cleanedDuration / 1000 : 0;

      stat.avgTime += time;
      stat.avgCleanTime += cleanTime;

      if (!components.has(component)) {
        components.add(component);
        stat.participantCount += 1;
      }

      if (answer.correctAnswer && answer.correctAnswer.length > 0) {
        const isCorrect = componentAnswersAreCorrect(answer.answer, answer.correctAnswer);
        stat.correctness += isCorrect ? 1 : 0;
      }
    });
  });

  return Object.values(stats)
    .map((stat) => {
      const questions = Object.values(validParticipants).flatMap((participant) => Object.keys(participant.answers).filter((key) => key.startsWith(stat.name) && participant.answers[key]?.correctAnswer?.length > 0));
      const totalAttempts = Object.values(validParticipants).reduce((count, participant) => count + Object.keys(participant.answers).filter((key) => key.startsWith(stat.name) && participant.answers[key].endTime !== -1).length, 0);
      const hasCorrectAnswers = questions.length > 0;

      return {
        ...stat,
        avgTime: totalAttempts ? stat.avgTime / totalAttempts : 0,
        avgCleanTime: totalAttempts ? stat.avgCleanTime / totalAttempts : 0,
        correctness: hasCorrectAnswers ? (stat.correctness / questions.length) * 100 : NaN,
      };
    });
}

export function calculateResponseStats(visibleParticipants: ParticipantData[]) {
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);
  const stats: Record<string, { name: string; correctness: number; participantCount: number }> = {};

  validParticipants.forEach((participant) => {
    Object.entries(participant.answers).forEach(([taskId, answer]) => {
      const parts = taskId.split('_');
      const component = parts.length === 4 ? parts[2] : parts[0];

      if (!stats[component]) {
        stats[component] = {
          name: component,
          correctness: 0,
          participantCount: 0,
        };
      }
      // In progress participants are not included in the stats
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

  return Object.values(stats)
    .map((stat) => {
      // Check if any participant has correct answers defined for this component
      const hasCorrectAnswers = Object.values(validParticipants).some((participant) => Object.entries(participant.answers).some(([key, answer]) => {
        const parts = key.split('_');
        const component = parts.length === 4 ? parts[2] : parts[0];
        return component === stat.name && answer.correctAnswer && answer.correctAnswer.length > 0;
      }));
      return {
        ...stat,
        correctness: hasCorrectAnswers ? (stat.correctness / stat.participantCount) * 100 : NaN,
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

export async function checkParticipantCountMismatch(
  calculatedCounts: ParticipantCounts,
  storageEngine: StorageEngine,
  studyId: string,
): Promise<{
  hasMismatch: boolean;
  mismatchDetails: {
    completed: { current: number; calculated: number };
    inProgress: { current: number; calculated: number };
    rejected: { current: number; calculated: number };
  } | null;
}> {
  try {
    const currentCounts = await storageEngine.getParticipantsStatusCounts(studyId);

    const calculatedTotal = calculatedCounts.completed + calculatedCounts.inProgress + calculatedCounts.rejected;
    const currentTotal = currentCounts.completed + currentCounts.inProgress + currentCounts.rejected;

    const hasMismatch = calculatedTotal === currentTotal && (
      calculatedCounts.completed !== currentCounts.completed
      || calculatedCounts.inProgress !== currentCounts.inProgress
      || calculatedCounts.rejected !== currentCounts.rejected
    );

    if (!hasMismatch) {
      return {
        hasMismatch: false,
        mismatchDetails: null,
      };
    }

    const mismatchDetails = {
      completed: { current: currentCounts.completed, calculated: calculatedCounts.completed },
      inProgress: { current: currentCounts.inProgress, calculated: calculatedCounts.inProgress },
      rejected: { current: currentCounts.rejected, calculated: calculatedCounts.rejected },
    };

    return {
      hasMismatch: true,
      mismatchDetails,
    };
  } catch (error) {
    console.error('Failed to check participant count mismatch:', error);
    return {
      hasMismatch: false,
      mismatchDetails: null,
    };
  }
}
