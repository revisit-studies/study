import { Button } from '@mantine/core';
import { To, useNavigate } from 'react-router-dom';
import { useStudyId } from '../routes';
import { useNextStep } from '../store/hooks/useNextStep';

type Props = {
  label?: string;
  disabled?: boolean;
  process?: null | (() => void | Promise<void>);
  to?: To | 'auto';
};

export function NextButton({
  label = 'Next',
  process = null,
  to = 'auto',
  disabled = false,
}: Props) {
  const navigate = useNavigate();
  const computedTo = `/${useStudyId()}/${useNextStep()}`;

  return (
    <Button
      type="submit"
      disabled={disabled || (to === 'auto' && !computedTo)}
      onClick={async () => {
        if (process) process();
        if (to === 'auto' && computedTo) {
          navigate(`${computedTo}${window.location.search}`);
        }
        if (to !== 'auto') {
          navigate(`${to}${window.location.search}`);
        }
      }}
    >
      {label}
    </Button>
  );
}
