import React, { useState, useEffect } from 'react';

interface DelayedResponseWrapperProps {
  delay?: number;
  disabled?: boolean;
  children: (isDelayedDisabled: boolean) => React.ReactNode;
}

export function DelayedResponseWrapper({
  delay = 0,
  disabled = false,
  children,
}: DelayedResponseWrapperProps) {
  const [isTimerDisabled, setIsTimerDisabled] = useState(delay > 0);

  useEffect(() => {
    if (!delay || delay <= 0) {
      setIsTimerDisabled(false);
      return undefined;
    }

    setIsTimerDisabled(true);
    const timer = setTimeout(() => {
      setIsTimerDisabled(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const effectiveDisabled = disabled || isTimerDisabled;

  return <>{children(effectiveDisabled)}</>;
}
