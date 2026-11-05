import React, { useState, useEffect } from 'react';

interface DelayedResponseWrapperProps {
  delay?: number;
  children: (isDelayedDisabled: boolean) => React.ReactNode;
}

export function DelayedResponseWrapper({
  delay = 0,
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

  return <>{children(isTimerDisabled)}</>;
}
