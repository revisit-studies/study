import { useParams } from 'react-router-dom';
import StimulusController from './StimulusController';
import { useTrialsConfig } from './utils';

// current active stimuli presented to the user

export default function TrialController() {
  const { trialId = null } = useParams<{ trialId: string }>();
  const config = useTrialsConfig();

  if (!trialId || !config) return null;

  const trial = config.trials[trialId];

  return (
    <StimulusController key={trialId} trialId={trialId} stimulus={trial} />
  );
}
