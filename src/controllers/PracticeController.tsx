import { useParams } from 'react-router-dom';

import StimulusController from './StimulusController';
import { usePracticeConfig } from './utils';

export default function PracticeController() {
  const { trialId = null } = useParams<{ trialId: string }>();
  const config = usePracticeConfig();

  if (!trialId || !config) return null;

  const trial = config.trials[trialId];

  return (
    <StimulusController key={trialId} trialId={trialId} stimulus={trial} />
  );
}
