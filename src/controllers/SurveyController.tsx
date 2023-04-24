
import {SurveyComponent} from '../parser/types';
import { useCurrentStep } from '../routes';
import {  useAppSelector } from '../store';

import {
  createTrialProvenance,
  TrialProvenanceContext,
} from '../store/trialProvenance';
import ResponseBlock from '../components/stimuli/inputcomponents/ResponseBlock';


export function useSurveyConfig() {
  const currentStep = useCurrentStep();

  return useAppSelector((state) => {
    const { config } = state.study;
    const component = currentStep ? config?.components[currentStep] : null;

    if (!config || !currentStep || component?.type !== 'survey') return null;

    return config.components[currentStep] as SurveyComponent;
  });
}


// current active stimuli presented to the user

export default function SurveyController() {
  const config = useSurveyConfig();

  const trialProvenance = createTrialProvenance();

  if (!config || !config) return null;

  const questions = config.questions;
  return (

    <div key={'survey'}>
        <ResponseBlock responses={questions} type={'survey'}/>
    </div>
  );
}
