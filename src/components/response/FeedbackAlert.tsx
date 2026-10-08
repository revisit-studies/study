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
  let primary = answer.answer === undefined ? undefined : format(answer.answer);
  if (answer.acceptableLow !== undefined && answer.acceptableHigh !== undefined) {
    primary = `${answer.acceptableLow} to ${answer.acceptableHigh} (inclusive)`;
  } else if (answer.acceptableLow !== undefined) {
    primary = `at least ${answer.acceptableLow}`;
  } else if (answer.acceptableHigh !== undefined) {
    primary = `at most ${answer.acceptableHigh}`;
  }
  return [...(primary === undefined ? [] : [primary]), ...(answer.acceptableAnswers ?? []).map(format)].join(' or ');
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
      title={currentAlert.title}
      color={currentAlert.color}
      style={currentAlert.fitHeight ? { height: 'fit-content' } : undefined}
    >
      <Text size="md">{currentAlert.message}</Text>
      {currentAlert.hint && <Text mt="sm" size="sm">{currentAlert.hint}</Text>}
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
        <>
          <br />
          {`The correct answer was: ${correctAnswer}.`}
        </>
      )}
    </Alert>
  ) : null;
}
