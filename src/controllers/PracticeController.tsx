import { useParams } from 'react-router-dom';

import StimulusController from './StimulusController';
import { usePracticeConfig } from './utils';


export default function PracticeController() {
    const { trialId = null } = useParams<{ trialId: string }>();
    const config = usePracticeConfig();
    
    if (!trialId || !config) return null;
  
    const trial = config.trials[trialId];
    
    const response = config.response;

    return <StimulusController trialId={trialId} stimulus={trial} response={response} type="practice"/>;
}
