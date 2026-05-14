export const DEFAULT_AUTO_ADVANCE_WARNING_TIME = 30000;
export const DEFAULT_AUTO_ADVANCE_WARNING_MESSAGE = 'You will be automatically advanced to the next component. Responses on this component will not be saved.';

export function formatAutoAdvanceWarningMessage(message: string, secondsRemaining: number) {
  if (message.includes('{seconds}') || message.includes('{unit}')) {
    return message
      .replaceAll('{seconds}', String(secondsRemaining))
      .replaceAll('{unit}', secondsRemaining === 1 ? 'second' : 'seconds');
  }

  return `${message} ${secondsRemaining} second${secondsRemaining === 1 ? '' : 's'} remaining.`;
}

export function getAutoAdvanceWarning({
  timer,
  autoAdvanceTime,
  warningTime = DEFAULT_AUTO_ADVANCE_WARNING_TIME,
  warningMessage = DEFAULT_AUTO_ADVANCE_WARNING_MESSAGE,
}: {
  timer?: number;
  autoAdvanceTime?: number;
  warningTime?: number;
  warningMessage?: string;
}) {
  if (
    timer === undefined
    || autoAdvanceTime === undefined
    || warningTime <= 0
  ) {
    return null;
  }

  const remainingTime = autoAdvanceTime - timer;
  if (remainingTime <= 0 || remainingTime > warningTime) {
    return null;
  }

  return {
    remainingTime,
    message: formatAutoAdvanceWarningMessage(
      warningMessage,
      Math.ceil(remainingTime / 1000),
    ),
  };
}
