import { Alert, Anchor } from '@mantine/core';
import { Response } from '../../parser/types';
import { useStoreDispatch, useStoreActions } from '../../store/store';

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
  alertConfig: Record<string, { visible: boolean; title: string; message: string; color: string }>;
  identifier: string;
  attemptsUsed: number;
  trainingAttempts: number;
}) {
  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText, incrementHelpCounter } = useStoreActions();

  return alertConfig[response.id]?.visible ? (
    <Alert mb="md" title={alertConfig[response.id].title} color={alertConfig[response.id].color}>
      {alertConfig[response.id].message}
      {alertConfig[response.id].message.includes('Please try again') && (
        <>
          <br />
          <br />
          If you&apos;re unsure
          {' '}
          <Anchor style={{ fontSize: 14 }} onClick={() => { storeDispatch(toggleShowHelpText()); storeDispatch(incrementHelpCounter({ identifier })); }}>review the help text.</Anchor>
          {' '}
        </>
      )}
      <br />
      <br />
      {attemptsUsed >= trainingAttempts && trainingAttempts >= 0 && correctAnswer && ` The correct answer was: ${correctAnswer}.`}
    </Alert>
  ) : null;
}
