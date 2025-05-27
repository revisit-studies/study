import { Button } from '@mantine/core';
import {
  useCallback,
} from 'react';
import { usePreviousStep } from '../store/hooks/usePreviousStep';

type Props = {
  label?: string;
  px?: number;
};

export function PreviousButton({
  label = 'Previous',
  px,
}: Props) {
  const { isPreviousDisabled, goToPreviousStep } = usePreviousStep();

  const handleClick = useCallback(() => {
    goToPreviousStep();
  }, [goToPreviousStep]);

  return (
    <Button
      type="submit"
      disabled={isPreviousDisabled}
      onClick={handleClick}
      px={px}
    >
      {label}
    </Button>
  );
}
