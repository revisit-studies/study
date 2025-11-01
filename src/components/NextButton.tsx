import { Alert, Button, Group } from '@mantine/core';
import {
  JSX, useEffect, useMemo, useState,
} from 'react';
import { IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useNextStep } from '../store/hooks/useNextStep';
import { IndividualComponent, ResponseBlockLocation } from '../parser/types';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { PreviousButton } from './PreviousButton';

type Props = {
  label?: string;
  disabled?: boolean;
  config?: IndividualComponent;
  location?: ResponseBlockLocation;
  checkAnswer: JSX.Element | null;
};

export function NextButton({
  label = 'Next',
  disabled = false,
  config,
  location,
  checkAnswer,
}: Props) {
  const { isNextDisabled, goToNextStep } = useNextStep();
  const studyConfig = useStudyConfig();
  const navigate = useNavigate();

  const nextButtonDisableTime = useMemo(() => config?.nextButtonDisableTime ?? studyConfig.uiConfig.nextButtonDisableTime, [config, studyConfig]);
  const nextButtonEnableTime = useMemo(() => config?.nextButtonEnableTime ?? studyConfig.uiConfig.nextButtonEnableTime ?? 0, [config, studyConfig]);

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
    if (timer && nextButtonDisableTime && timer >= nextButtonDisableTime && studyConfig.uiConfig.timeoutReject) {
      navigate('./../__timedOut');
    }
  }, [nextButtonDisableTime, timer, navigate, studyConfig.uiConfig.timeoutReject]);

  const buttonTimerSatisfied = useMemo(
    () => {
      const nextButtonDisableSatisfied = nextButtonDisableTime && timer ? timer <= nextButtonDisableTime : true;
      const nextButtonEnableSatisfied = timer ? timer >= nextButtonEnableTime : true;
      return nextButtonDisableSatisfied && nextButtonEnableSatisfied;
    },
    [nextButtonDisableTime, nextButtonEnableTime, timer],
  );

  const nextOnEnter = useMemo(() => config?.nextOnEnter ?? studyConfig.uiConfig.nextOnEnter, [config, studyConfig]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !disabled && !isNextDisabled && buttonTimerSatisfied) {
        goToNextStep();
      }
    };

    if (nextOnEnter) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return () => {};
  }, [disabled, isNextDisabled, buttonTimerSatisfied, goToNextStep, nextOnEnter]);

  const nextButtonDisabled = useMemo(() => disabled || isNextDisabled || !buttonTimerSatisfied, [disabled, isNextDisabled, buttonTimerSatisfied]);
  const previousButtonText = useMemo(() => config?.previousButtonText ?? studyConfig.uiConfig.previousButtonText ?? 'Previous', [config, studyConfig]);

  return (
    <>
      <Group justify="right" gap="xs" mt="sm">
        {config?.previousButton && (
          <PreviousButton
            label={previousButtonText}
            px={location === 'sidebar' && checkAnswer ? 8 : undefined}
          />
        )}
        {checkAnswer}
        <Button
          type="submit"
          disabled={nextButtonDisabled}
          onClick={() => goToNextStep()}
          px={location === 'sidebar' && checkAnswer ? 8 : undefined}
        >
          {label}
        </Button>
      </Group>
      {timer && (
        <>
          {nextButtonEnableTime > 0 && timer < nextButtonEnableTime && (
            <Alert mt="md" title="Please wait" color="blue" icon={<IconInfoCircle />}>
              The next button will be enabled in
              {' '}
              {Math.ceil((nextButtonEnableTime - timer) / 1000)}
              {' '}
              seconds.
            </Alert>
          )}
          {nextButtonDisableTime && timer && (nextButtonDisableTime - timer) < 10000 && (
            (nextButtonDisableTime - timer) > 0
              ? (
                <Alert mt="md" title="Next button disables soon" color="yellow" icon={<IconAlertTriangle />}>
                  The next button disables in
                  {' '}
                  {Math.ceil((nextButtonDisableTime - timer) / 1000)}
                  {' '}
                  seconds.
                </Alert>
              ) : !studyConfig.uiConfig.timeoutReject && (
                <Alert mt="md" title="Next button disabled" color="red" icon={<IconAlertTriangle />}>
                  The next button has timed out and is now disabled.
                  <Group justify="right" mt="sm">
                    <Button onClick={() => goToNextStep(false)} variant="link" color="red">Proceed</Button>
                  </Group>
                </Alert>
              ))}
        </>

      )}
    </>
  );
}
