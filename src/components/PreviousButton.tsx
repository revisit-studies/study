import { Button } from '@mantine/core';
import {
  useCallback,
} from 'react';
import { usePreviousStep } from '../store/hooks/usePreviousStep';
import { IndividualComponent } from '../parser/types';

type Props = {
  label?: string;
  configInUse?: IndividualComponent;
  px?: number;
};

export function PreviousButton({
  label = 'Previous',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  configInUse,
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
