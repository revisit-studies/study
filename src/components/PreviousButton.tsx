import { Alert, Button } from '@mantine/core';
import {
  useCallback,
} from 'react';
import { IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';
import { usePreviousStep } from '../store/hooks/usePreviousStep';
import { IndividualComponent } from '../parser/types';
import { useStudyConfig } from '../store/hooks/useStudyConfig';

type Props = {
  label?: string;
  disabled?: boolean;
  onClick?: null | (() => void | Promise<void>);
  configInUse?: IndividualComponent;
  timer?: number;
};

export function PreviousButton({
  label = 'Previous',
  disabled = false,
  onClick,
  configInUse,
  timer,
}: Props) {
  const { isPreviousDisabled, goToPreviousStep } = usePreviousStep();
  const studyConfig = useStudyConfig();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
    goToPreviousStep();
  }, [goToPreviousStep, onClick]);

  const previousButtonDisableTime = configInUse?.nextButtonDisableTime;
  const previousButtonEnableTime = configInUse?.nextButtonEnableTime || 0;

  return (
    <>
      <Button
        type="submit"
        disabled={disabled || isPreviousDisabled}
        onClick={handleClick}
      >
        {label}
      </Button>
      {previousButtonEnableTime > 0 && timer && timer < previousButtonEnableTime && (
        <Alert mt="md" title="Please wait" color="blue" icon={<IconInfoCircle />}>
          The previous button will be enabled in
          {' '}
          {Math.ceil((previousButtonEnableTime - timer) / 1000)}
          {' '}
          seconds.
        </Alert>
      )}
      {previousButtonDisableTime && timer && (previousButtonDisableTime - timer) < 10000 && (
        (previousButtonDisableTime - timer) > 0
          ? (
            <Alert mt="md" title="Previous button disables soon" color="yellow" icon={<IconAlertTriangle />}>
              The previous button disables in
              {' '}
              {Math.ceil((previousButtonDisableTime - timer) / 1000)}
              {' '}
              seconds.
            </Alert>
          ) : !studyConfig.uiConfig.timeoutReject && (
            <Alert mt="md" title="Previous button disabled" color="red" icon={<IconAlertTriangle />}>
              The previous button has timed out and is now disabled.
            </Alert>
          ))}
    </>
  );
}
