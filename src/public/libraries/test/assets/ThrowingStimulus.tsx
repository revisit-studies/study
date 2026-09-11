import { useEffect } from 'react';
import type { StimulusParams } from '../../../../store/types';

type ThrowingStimulusParameters = {
  failure: 'render' | 'effect';
};

export default function ThrowingStimulus({ parameters }: StimulusParams<ThrowingStimulusParameters>) {
  useEffect(() => {
    if (parameters.failure === 'effect') throw new Error('Stimulus initialization failed');
  }, [parameters.failure]);

  if (parameters.failure === 'render') throw new Error('Stimulus initialization failed');

  return <span>Stimulus loaded</span>;
}
