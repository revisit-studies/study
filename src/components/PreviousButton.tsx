import { Alert, Button } from '@mantine/core';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { usePreviousStep } from '../store/hooks/usePreviousStep';
import { IndividualComponent } from '../parser/types';
import { useStudyConfig } from '../store/hooks/useStudyConfig';

type Props = {
  label?: string;
  disabled?: boolean;
  onClick?: null | (() => void | Promise<void>);
  configInUse?: IndividualComponent;
};

export function PreviousButton({
  label = 'Previous',
  disabled = false,
  onClick,
  configInUse,
}: Props) {
  const { isPreviousDisabled, goToPreviousStep } = usePreviousStep();
  const studyConfig = useStudyConfig();
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
    goToPreviousStep();
  }, [goToPreviousStep, onClick]);

  // If previousButtonDisableTime is set, use that, otherwise use nextButtonDisableTime
  const previousButtonDisableTime = configInUse?.previousButtonDisableTime ? configInUse?.previousButtonDisableTime : configInUse?.nextButtonDisableTime;
  // If previousButtonEnableTime is set, use that, otherwise use nextButtonEnableTime or 0 if not set
  const previousButtonEnableTime = configInUse?.previousButtonEnableTime ? configInUse?.previousButtonEnableTime : configInUse?.nextButtonEnableTime || 0;
  const [timer, setTimer] = useState<number | undefined>(undefined);
  // Start a timer on first render, update timer every 100ms
  useEffect(() => {
    let time = 0;
    const interval = setInterval(() => {
      time += 100;
      setTimer(time);
    }, 100);
    return () => {
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    if (timer && previousButtonDisableTime && timer >= previousButtonDisableTime && studyConfig.uiConfig.timeoutReject) {
      navigate('./../__timedOut');
    }
  }, [previousButtonDisableTime, timer, navigate, studyConfig.uiConfig.timeoutReject]);

  const buttonTimerSatisfied = useMemo(
    () => {
      const previousButtonDisableSatisfied = previousButtonDisableTime && timer ? timer <= previousButtonDisableTime : true;
      const previousButtonEnableSatisfied = timer ? timer >= previousButtonEnableTime : true;
      return previousButtonDisableSatisfied && previousButtonEnableSatisfied;
    },
    [previousButtonDisableTime, previousButtonEnableTime, timer],
  );

  return (
    <>
      <Button
        type="submit"
        disabled={disabled || isPreviousDisabled || !buttonTimerSatisfied}
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
