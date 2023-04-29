import ResponseBlock from '../components/response/ResponseBlock';
import { useSurveyConfig } from './utils';


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
