import {
  Alert, Button, Group, Kbd,
} from '@mantine/core';
import {
  JSX, useEffect, useMemo, useRef, useState,
} from 'react';
import { IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useNextStep } from '../store/hooks/useNextStep';
import { shouldIgnoreEnter } from './keyboardUtils';
import type { IndividualComponent, ResponseBlockLocation } from '../parser/types';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { useCurrentIdentifier } from '../routes/utils';
import { PreviousButton } from './PreviousButton';
import { getComponentContainerStyle } from '../utils/componentStyle';
import {
  DEFAULT_AUTO_ADVANCE_WARNING_MESSAGE,
  DEFAULT_AUTO_ADVANCE_WARNING_TIME,
  getAutoAdvanceWarning,
} from './nextButtonTimeout';
import type { AutoAdvanceSelection } from './response/autoAdvanceEvents';

const nextButtonJustify = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
} as const;

type Props = {
  label?: string;
  disabled?: boolean;
  config?: IndividualComponent;
  location?: ResponseBlockLocation;
  checkAnswer: JSX.Element | null;
  onCheckAnswer?: () => void;
  onNext: () => boolean;
  autoAdvanceRequest?: AutoAdvanceSelection;
  autoAdvanceEligible?: boolean;
};

export function NextButton({
  label = 'Next',
  disabled = false,
  config,
  location,
  checkAnswer,
  onCheckAnswer,
  onNext,
  autoAdvanceRequest,
  autoAdvanceEligible = true,
}: Props) {
  const { isNextDisabled, goToNextStep } = useNextStep(config?.response, config?.correctAnswer);
  const studyConfig = useStudyConfig();
  const navigate = useNavigate();
  const identifier = useCurrentIdentifier();

  const nextButtonDisableTime = config?.nextButtonDisableTime ?? studyConfig.uiConfig.nextButtonDisableTime;
  const nextButtonEnableTime = config?.nextButtonEnableTime ?? studyConfig.uiConfig.nextButtonEnableTime ?? 0;
  const nextButtonAutoAdvanceTime = config?.nextButtonAutoAdvanceTime;
  const nextButtonAutoAdvanceWarningTime = config?.nextButtonAutoAdvanceWarningTime ?? DEFAULT_AUTO_ADVANCE_WARNING_TIME;
  const nextButtonAutoAdvanceWarningMessage = config?.nextButtonAutoAdvanceWarningMessage ?? DEFAULT_AUTO_ADVANCE_WARNING_MESSAGE;
  const responseAutoAdvances = config?.response?.some((response) => response.type === 'buttons' && response.autoAdvanceToNextStep && !response.hidden);
  const nextButtonHidden = config?.nextButtonHidden ?? (
    nextButtonAutoAdvanceTime !== undefined
    || responseAutoAdvances
    || false
  );

  const [timer, setTimer] = useState<number | undefined>(undefined);
  const deadlineAutoAdvanceTriggered = useRef(false);
  const navigationStarted = useRef(false);
  const attemptedRequest = useRef<number | undefined>(undefined);
  const latestOnNext = useRef(onNext);
  const [readyAutoAdvanceRequest, setReadyAutoAdvanceRequest] = useState<number | undefined>();

  useEffect(() => {
    latestOnNext.current = onNext;
  }, [onNext]);

  useEffect(() => {
    if (!autoAdvanceEligible) {
      attemptedRequest.current = undefined;
    }
  }, [autoAdvanceEligible]);
  // Use the current identifier so nested function-sequence items reset their timer state.
  useEffect(() => {
    deadlineAutoAdvanceTriggered.current = false;
    navigationStarted.current = false;
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
    setReadyAutoAdvanceRequest(undefined);
    if (!autoAdvanceRequest || !autoAdvanceRequest.selected || autoAdvanceRequest.identifier !== identifier) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setReadyAutoAdvanceRequest(autoAdvanceRequest.eventId);
    }, autoAdvanceRequest.delay);
    return () => clearTimeout(timeout);
  }, [autoAdvanceRequest, identifier]);

  useEffect(() => {
    if (timer === undefined) {
      return;
    }
    if (nextButtonDisableTime && timer >= nextButtonDisableTime && studyConfig.uiConfig.timeoutReject) {
      navigate(`./../__timedOut${window.location.search}`);
    }
  }, [nextButtonDisableTime, timer, navigate, studyConfig.uiConfig.timeoutReject]);

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

  const nextButtonDisabled = disabled || isNextDisabled || !buttonTimerSatisfied;

  useEffect(() => {
    if (isNextDisabled || timer === undefined || nextButtonAutoAdvanceTime === undefined || timer < nextButtonAutoAdvanceTime || deadlineAutoAdvanceTriggered.current) {
      return;
    }

    deadlineAutoAdvanceTriggered.current = true;
    if (!navigationStarted.current && goToNextStep(false)) {
      navigationStarted.current = true;
    }
  }, [goToNextStep, isNextDisabled, nextButtonAutoAdvanceTime, timer]);

  useEffect(() => {
    if (
      readyAutoAdvanceRequest === undefined
      || !autoAdvanceRequest?.selected
      || autoAdvanceRequest.eventId !== readyAutoAdvanceRequest
      || autoAdvanceRequest.identifier !== identifier
      || nextButtonDisabled
      || !autoAdvanceEligible
      || navigationStarted.current
      || attemptedRequest.current === readyAutoAdvanceRequest
    ) {
      return;
    }

    attemptedRequest.current = readyAutoAdvanceRequest;
    if (latestOnNext.current()) {
      navigationStarted.current = true;
    }
  }, [autoAdvanceEligible, autoAdvanceRequest, identifier, nextButtonDisabled, readyAutoAdvanceRequest]);

  const autoAdvanceWarning = useMemo(() => getAutoAdvanceWarning({
    timer,
    autoAdvanceTime: nextButtonAutoAdvanceTime,
    warningTime: nextButtonAutoAdvanceWarningTime,
    warningMessage: nextButtonAutoAdvanceWarningMessage,
  }), [nextButtonAutoAdvanceTime, nextButtonAutoAdvanceWarningMessage, nextButtonAutoAdvanceWarningTime, timer]);

  const nextOnEnter = config?.nextOnEnter ?? studyConfig.uiConfig.nextOnEnter;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented || (event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled || shouldIgnoreEnter(event.target)) {
        return;
      }

      if (onCheckAnswer) {
        onCheckAnswer();
        return;
      }
      if (!disabled && !isNextDisabled && buttonTimerSatisfied && !nextButtonHidden) {
        onNext();
      }
    };

    if (nextOnEnter) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, isNextDisabled, nextButtonHidden, buttonTimerSatisfied, onCheckAnswer, onNext, nextOnEnter]);

  const previousButtonText = config?.previousButtonText ?? studyConfig.uiConfig.previousButtonText ?? 'Previous';
  const nextButtonAlignment = config?.nextButtonAlignment ?? studyConfig.uiConfig.nextButtonAlignment ?? 'right';
  const componentWidth = config && getComponentContainerStyle(config.type, config.style);

  return (
    <>
      <Group
        className={location === 'sidebar' ? undefined : 'responseBlock-actions'}
        data-alignment={nextButtonAlignment}
        justify={nextButtonJustify[nextButtonAlignment]}
        gap="xs"
        mt="sm"
        wrap="wrap"
        style={location === 'sidebar' ? undefined : { width: componentWidth?.width, maxWidth: componentWidth?.maxWidth }}
      >
        {config?.previousButton && (
          <PreviousButton
            label={previousButtonText}
            px={location === 'sidebar' && checkAnswer ? 8 : undefined}
          />
        )}
        {checkAnswer}
        {!nextButtonHidden && (
          <Button
            type="submit"
            disabled={nextButtonDisabled}
            onClick={() => onNext()}
            px={location === 'sidebar' && checkAnswer ? 8 : undefined}
            aria-label={label}
            rightSection={nextOnEnter && !onCheckAnswer ? (
              <Kbd
                size="xs"
                aria-hidden="true"
                style={{
                  backgroundColor: 'transparent',
                  color: 'inherit',
                  boxShadow: 'none',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                ↵
              </Kbd>
            ) : undefined}
            styles={{
              inner: { alignItems: 'stretch' },
              section: nextOnEnter && !onCheckAnswer ? {
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 10px',
                marginRight: -16,
                marginBlock: -1,
                borderLeft: '1px solid rgba(255, 255, 255, 0.25)',
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
              } : undefined,
            }}
          >
            {label}
          </Button>
        )}
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
                    <Button disabled={isNextDisabled} onClick={() => goToNextStep(false)} variant="link" color="red">Proceed</Button>
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
