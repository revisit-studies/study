import { Button } from '@mantine/core';
import { useNextStep } from '../store/hooks/useNextStep';
import { useCallback } from 'react';

type Props = {
  label?: string;
  disabled?: boolean;
  onClick?: null | (() => void | Promise<void>);
  setCheckClicked: (arg: boolean) => void | null
};

export function NextButton({
  label = 'Next',
  disabled = false,
  setCheckClicked = () => {},
  onClick,
}: Props) {
  const { isNextDisabled, goToNextStep } = useNextStep();

  const handleClick = useCallback(() => {
    setCheckClicked(false);
    if (onClick) {
      onClick();
    }
    goToNextStep();
  }, [goToNextStep, onClick, setCheckClicked]);

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
