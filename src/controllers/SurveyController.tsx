
import {SurveyComponent} from '../parser/types';
import { useCurrentStep } from '../routes';
import {  useAppSelector } from '../store';

import ResponseBlock from '../components/response/ResponseBlock';


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

  if (!config || !config) return null;
  return (

    <div key={'survey'}>
        <ResponseBlock location='aboveStimulus'/>
        <ResponseBlock location='belowStimulus'/>
    </div>
  );
}
