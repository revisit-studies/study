import { Alert, Anchor, Text } from '@mantine/core';
import { Answer, Response, ResponseFeedback } from '../../parser/types';
import { useStoreDispatch, useStoreActions } from '../../store/store';

export function getTrainingFeedbackText(text: ResponseFeedback['correctText'], attemptsUsed: number): string | undefined {
  return Array.isArray(text) ? text[Math.min(Math.max(0, attemptsUsed - 1), text.length - 1)] : text;
}

export function formatTrainingFeedback(text: string, attemptsUsed: number, trainingAttempts: number) {
  const tokens: Record<string, number | string> = {
    attemptsUsed,
    attemptsLeft: trainingAttempts === -1 ? 'unlimited' : Math.max(0, trainingAttempts - attemptsUsed),
  };
  return text.replace(/\{(attemptsUsed|attemptsLeft)\}/g, (_, token: string) => String(tokens[token]));
}

/** Describe all accepted answers when training attempts are exhausted. */
export function formatCorrectAnswer(answer: Answer): string {
  const format = (value: unknown) => (typeof value === 'object' ? JSON.stringify(value) : String(value));
  const formatRange = (low?: number, high?: number) => (
    low !== undefined && high !== undefined
      ? `${low} to ${high} (inclusive)`
      : low !== undefined
        ? `at least ${low}`
        : high !== undefined
          ? `at most ${high}`
          : undefined
  );
  const exactAnswer = answer.answer === undefined ? undefined : format(answer.answer);
  const correctRange = formatRange(answer.lowestCorrect, answer.highestCorrect);
  const almostCorrectRange = formatRange(answer.acceptableLow, answer.acceptableHigh);
  const ranges = [
    correctRange === undefined ? undefined : `correct range: ${correctRange}`,
    almostCorrectRange === undefined ? undefined : `almost-correct range: ${almostCorrectRange}`,
  ].filter((range): range is string => range !== undefined);
  const primary = exactAnswer === undefined
    ? ranges.join('; ')
    : `${exactAnswer}${ranges.length > 0 ? ` (${ranges.join('; ')})` : ''}`;
  return [...(primary ? [primary] : []), ...(answer.acceptableAnswers ?? []).map(format)].join(' or ');
}

export function FeedbackAlert({
  response,
  correctAnswer,
  alertConfig,
  identifier,
  attemptsUsed,
  trainingAttempts,
}: {
  response: Response;
  correctAnswer: string | undefined;
  alertConfig: Record<string, { visible: boolean; title: string; message: string; color: string; retryAllowed?: boolean; showHelpTextLink?: boolean; fitHeight?: boolean; hint?: string }>;
  identifier: string;
  attemptsUsed: number;
  trainingAttempts: number;
}) {
  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText, incrementHelpCounter } = useStoreActions();
  const currentAlert = alertConfig[response.id];

  return currentAlert?.visible ? (
    <Alert
      mb="md"
      title={<Text size="lg" fw={700}>{currentAlert.title}</Text>}
      color={currentAlert.color}
      style={currentAlert.fitHeight ? { height: 'fit-content' } : undefined}
    >
      <Text size="md">{currentAlert.message}</Text>
      {currentAlert.hint && <Text mt="sm" size="md">{currentAlert.hint}</Text>}
      {currentAlert.showHelpTextLink !== false
        && (currentAlert.retryAllowed ?? currentAlert.message.includes('Please try again')) && (
        <>
          <br />
          <br />
          If you&apos;re unsure
          {' '}
          <Anchor style={{ fontSize: 14 }} onClick={() => { storeDispatch(toggleShowHelpText()); storeDispatch(incrementHelpCounter({ identifier })); }}>review the help text.</Anchor>
          {' '}
        </>
      )}
      {attemptsUsed >= trainingAttempts && trainingAttempts >= 0 && correctAnswer && (
        <Text size="md">
          <br />
          {`The correct answer was: ${correctAnswer}.`}
        </Text>
      )}
    </Alert>
  ) : null;
}
