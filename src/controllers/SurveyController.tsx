import ResponseBlock from '../components/response/ResponseBlock';
import { useSurveyConfig } from './utils';

export default function SurveyController() {
  const config = useSurveyConfig();

  console.log(config);

  if (!config) return null;
  return (
    <div>
      <ResponseBlock config={config} location="aboveStimulus" status={null} />
      <ResponseBlock config={config} location="belowStimulus" status={null} />
    </div>
  );
}
