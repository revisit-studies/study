import { Button } from '@mantine/core';
import {
  useCallback,
} from 'react';
import { usePreviousStep } from '../store/hooks/usePreviousStep';
import { useStoreActions, useStoreDispatch } from '../store/store';

type Props = {
  label?: string;
  px?: number;
};

export function PreviousButton({
  label = 'Previous',
  px,
}: Props) {
  const { isPreviousDisabled, goToPreviousStep } = usePreviousStep();
  const storeDispatch = useStoreDispatch();
  const { setClickedPrevious } = useStoreActions();

  const handleClick = useCallback(() => {
    storeDispatch(setClickedPrevious(true));
    goToPreviousStep();
  }, [goToPreviousStep, setClickedPrevious, storeDispatch]);

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
