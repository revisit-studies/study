import { Alert, Button, Group } from '@mantine/core';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useNextStep } from '../store/hooks/useNextStep';
import { IndividualComponent } from '../parser/types';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { studyComponentToIndividualComponent } from '../utils/handleComponentInheritance';
import { useStoreSelector } from '../store/store';
import { useCurrentComponent } from '../routes/utils';

type Props = {
  label?: string;
  disabled?: boolean;
  onClick?: null | (() => void | Promise<void>);
  configInUse?: IndividualComponent;
};

export function NextButton({
  label = 'Next',
  disabled = false,
  onClick,
  configInUse,
}: Props) {
  const { isNextDisabled, goToNextStep } = useNextStep();
  const studyConfig = useStudyConfig();
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
    goToNextStep();
  }, [goToNextStep, onClick]);

  const nextButtonDisableTime = configInUse?.nextButtonDisableTime !== undefined ? configInUse.nextButtonDisableTime : studyConfig.uiConfig.nextButtonDisableTime;
  const nextButtonEnableTime = configInUse?.nextButtonEnableTime !== undefined ? configInUse.nextButtonEnableTime : studyConfig.uiConfig.nextButtonEnableTime || 0;
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

  const currentComponent = useCurrentComponent();
  const config = useStoreSelector((state) => state.config);
  const componentConfig = useMemo(() => studyComponentToIndividualComponent(config.components[currentComponent] || {}, config), [currentComponent, config]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !disabled && !isNextDisabled && buttonTimerSatisfied) {
        goToNextStep();
      }
    };

    const isNextOnEnterEnabled = componentConfig?.nextOnEnter !== undefined ? componentConfig.nextOnEnter : studyConfig.uiConfig.nextOnEnter;
    if (isNextOnEnterEnabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return () => {};
  }, [disabled, isNextDisabled, buttonTimerSatisfied, goToNextStep, studyConfig.uiConfig.nextOnEnter, componentConfig?.nextOnEnter]);

  return (
    <>
      <Button
        type="submit"
        disabled={disabled || isNextDisabled || !buttonTimerSatisfied}
        onClick={handleClick}
      >
        {label}
      </Button>
      {nextButtonEnableTime > 0 && timer && timer < nextButtonEnableTime && (
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
  );
}
