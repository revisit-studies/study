import ResponseBlock from '../components/stimuli/inputcomponents/ResponseBlock';
import { SurveyComponent } from '../parser/types';
import { useCurrentStep } from '../routes';
import { useAppSelector } from '../store';

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

export const SURVEY_AB_STM_RSP = 'survey_aboveStimulus';
export const SURVEY_BLW_STM_RSP = 'survey_belowStimulus';

export default function SurveyController() {
  const config = useSurveyConfig();

  if (!config) return null;
  return (
    <div>
      <ResponseBlock config={config} location="aboveStimulus" status={null} />
      <ResponseBlock config={config} location="belowStimulus" status={null} />
    </div>
  );
}
