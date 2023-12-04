import { Button } from '@mantine/core';
import { useNextStep } from '../store/hooks/useNextStep';
import { useCallback } from 'react';

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
  const { isDisabled, goToNextStep } = useNextStep();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
    goToNextStep();
  }, [goToNextStep, onClick]);

  return (
    <Button
      type="submit"
      disabled={disabled || isDisabled}
      onClick={handleClick}
    >
      {label}
    </Button>
  );
}
