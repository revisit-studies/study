import { useParams } from 'react-router-dom';
import StimulusController from './StimulusController';
import { useTrialsConfig, usePracticeConfig } from './utils';

export default function TrialController() {
  const { trialId = null } = useParams<{ trialId: string }>();
  const trialConfig = useTrialsConfig();
  const practiceConfig = usePracticeConfig();

  const config = trialConfig !== null ? trialConfig : practiceConfig;

  if (!trialId || !config) return null;

  const trial = config.trials[trialId]; 

  return <StimulusController trialId={trialId} stimulus={trial}/>;
}
