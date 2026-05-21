import { Alert, Button, Group } from '@mantine/core';
import {
  JSX, useEffect, useMemo, useRef, useState,
} from 'react';
import { IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useNextStep } from '../store/hooks/useNextStep';
import type { IndividualComponent, ResponseBlockLocation } from '../parser/types';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { useCurrentIdentifier } from '../routes/utils';
import { PreviousButton } from './PreviousButton';
import {
  DEFAULT_AUTO_ADVANCE_WARNING_MESSAGE,
  DEFAULT_AUTO_ADVANCE_WARNING_TIME,
  getAutoAdvanceWarning,
} from './nextButtonTimeout';

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
  const identifier = useCurrentIdentifier();

  const nextButtonDisableTime = config?.nextButtonDisableTime ?? studyConfig.uiConfig.nextButtonDisableTime;
  const nextButtonEnableTime = config?.nextButtonEnableTime ?? studyConfig.uiConfig.nextButtonEnableTime ?? 0;
  const nextButtonAutoAdvanceTime = config?.nextButtonAutoAdvanceTime;
  const nextButtonAutoAdvanceWarningTime = config?.nextButtonAutoAdvanceWarningTime ?? DEFAULT_AUTO_ADVANCE_WARNING_TIME;
  const nextButtonAutoAdvanceWarningMessage = config?.nextButtonAutoAdvanceWarningMessage ?? DEFAULT_AUTO_ADVANCE_WARNING_MESSAGE;

  const [timer, setTimer] = useState<number | undefined>(undefined);
  const autoAdvanceTriggered = useRef(false);
  // Use the current identifier so nested function-sequence items reset their timer state.
  useEffect(() => {
    autoAdvanceTriggered.current = false;
    const start = Date.now();
    setTimer(0);
    const interval = setInterval(() => {
      setTimer(Date.now() - start);
    }, 100);
    return () => {
      clearInterval(interval);
    };
  }, [identifier]);

  useEffect(() => {
    if (timer === undefined) {
      return;
    }
    if (nextButtonDisableTime && timer >= nextButtonDisableTime && studyConfig.uiConfig.timeoutReject) {
      navigate(`./../__timedOut${window.location.search}`);
    }
  }, [nextButtonDisableTime, timer, navigate, studyConfig.uiConfig.timeoutReject]);

  useEffect(() => {
    if (timer === undefined || nextButtonAutoAdvanceTime === undefined || timer < nextButtonAutoAdvanceTime || autoAdvanceTriggered.current) {
      return;
    }

    autoAdvanceTriggered.current = true;
    goToNextStep(false);
  }, [goToNextStep, nextButtonAutoAdvanceTime, timer]);

  const buttonTimerSatisfied = useMemo(
    () => {
      if (timer === undefined) {
        return true;
      }
      const nextButtonDisableSatisfied = nextButtonDisableTime ? timer <= nextButtonDisableTime : true;
      const nextButtonEnableSatisfied = nextButtonEnableTime ? timer >= nextButtonEnableTime : true;
      return nextButtonDisableSatisfied && nextButtonEnableSatisfied;
    },
    [nextButtonDisableTime, nextButtonEnableTime, timer],
  );

  const autoAdvanceWarning = useMemo(() => getAutoAdvanceWarning({
    timer,
    autoAdvanceTime: nextButtonAutoAdvanceTime,
    warningTime: nextButtonAutoAdvanceWarningTime,
    warningMessage: nextButtonAutoAdvanceWarningMessage,
  }), [nextButtonAutoAdvanceTime, nextButtonAutoAdvanceWarningMessage, nextButtonAutoAdvanceWarningTime, timer]);

  const nextOnEnter = config?.nextOnEnter ?? studyConfig.uiConfig.nextOnEnter;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !disabled && !isNextDisabled && buttonTimerSatisfied) {
        goToNextStep();
      }
    };

    if (nextOnEnter) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, isNextDisabled, buttonTimerSatisfied, goToNextStep, nextOnEnter]);

  const nextButtonDisabled = disabled || isNextDisabled || !buttonTimerSatisfied;
  const previousButtonText = config?.previousButtonText ?? studyConfig.uiConfig.previousButtonText ?? 'Previous';

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
      {timer !== undefined && (
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
          {nextButtonDisableTime && (nextButtonDisableTime - timer) < 10000 && (
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
          {autoAdvanceWarning && (
            <Alert mt="md" title="Automatically advancing soon" color="yellow" icon={<IconAlertTriangle />}>
              {autoAdvanceWarning.message}
            </Alert>
          )}
        </>
      )}
    </>
  );
}
