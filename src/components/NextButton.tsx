import { Button } from '@mantine/core';
import { To } from 'react-router-dom';
import { useStudyId } from '../routes';
import { useNextStep } from '../store/hooks/useNextStep';
import { useNavigateWithParams } from '../utils/useNavigateWithParams';

type Props = {
  label?: string;
  disabled?: boolean;
  process?: null | (() => void | Promise<void>);
  to?: To | 'auto';
  replace?: boolean;
};

export function NextButton({
  label = 'Next',
  process = null,
  to = 'auto',
  disabled = false,
  replace = false,
}: Props) {
  const navigate = useNavigateWithParams();
  const computedTo = `/${useStudyId()}/${useNextStep()}`;

  return (
    <Button
      type="submit"
      disabled={disabled || (to === 'auto' && !computedTo)}
      onClick={async () => {
        if (process) process();
        if (to === 'auto' && computedTo) {
          navigate(`${computedTo}`, { replace });
        }
        if (to !== 'auto') {
          navigate(to, { replace });
        }
      }}
    >
      {label}
    </Button>
  );
}
