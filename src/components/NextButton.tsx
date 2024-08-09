import { Button } from '@mantine/core';
import { useCallback } from 'react';
import { useNextStep } from '../store/hooks/useNextStep';

type Props = {
  label?: string;
  disabled?: boolean;
  onClick?: null | (() => void | Promise<void>);
};

export function NextButton({
  label = 'Next',
  disabled = false,
  onClick,
}: Props) {
  const { isNextDisabled, goToNextStep } = useNextStep();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
    goToNextStep();
  }, [goToNextStep, onClick]);

  return (
    <Button
      type="submit"
      disabled={disabled || isNextDisabled}
      onClick={handleClick}
    >
      {label}
    </Button>
  );
}
