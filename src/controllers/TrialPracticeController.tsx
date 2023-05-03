import { useParams } from 'react-router-dom';
import StimulusController from './StimulusController';
import { usePracticeConfig, useTrialsConfig } from './utils';

export default function TrialPracticeController() {
  const { trialId = null } = useParams<{ trialId: string }>();
  const trialConfig = useTrialsConfig();
  const practiceConfig = usePracticeConfig();

  const config = trialConfig !== null ? trialConfig : practiceConfig;

  if (!trialId || !config) return null;

  const trial = config.trials[trialId];

  return (
    <StimulusController key={trialId} trialId={trialId} stimulus={trial} />
  );
}
