import { Suspense } from 'react';
import ResponseBlock from '../components/response/ResponseBlock';
import IframeController from './IframeController';
import ImageController from './ImageController';
import ReactComponentController from './ReactComponentController';
import MarkdownController from './MarkdownController';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { useCurrentStep } from '../routes';
import { useStoredAnswer } from '../store/hooks/useStoredAnswer';
import ReactMarkdownWrapper from '../components/ReactMarkdownWrapper';
import { isPartialComponent } from '../parser/parser';
import merge from 'lodash.merge';
import { IndividualComponent } from '../parser/types';
import { disableBrowserBack } from '../utils/disableBrowserBack';

// current active stimuli presented to the user
export default function ComponentController() {
  // Get the config for the current step
  const studyConfig = useStudyConfig();
  const currentStep = useCurrentStep();
  const stepConfig = studyConfig.components[currentStep];
  
  // If we have a trial, use that config to render the right component else use the step
  const status = useStoredAnswer();

  const currentConfig = isPartialComponent(stepConfig) && studyConfig.baseComponents ? merge({}, studyConfig.baseComponents?.[stepConfig.baseComponent], stepConfig) as IndividualComponent : stepConfig as IndividualComponent;

  const instruction = (currentConfig.instruction || '');
  const instructionLocation = currentConfig.instructionLocation;
  const instructionInSideBar = studyConfig.uiConfig.sidebar && (instructionLocation === 'sidebar' || instructionLocation === undefined);

  // Disable browser back button from all stimuli
  disableBrowserBack();

  return (
    <>
      {instructionLocation === 'aboveStimulus' && <ReactMarkdownWrapper text={instruction} />}
      <ResponseBlock
        key={`${currentStep}-above-response-block`}
        status={status}
        config={currentConfig}
        location="aboveStimulus"
      />

      <Suspense key={`${currentStep}-stimulus`} fallback={<div>Loading...</div>}>
        {currentConfig.type === 'markdown' && <MarkdownController currentConfig={currentConfig} />}
        {currentConfig.type === 'website' && <IframeController currentConfig={currentConfig} />}
        {currentConfig.type === 'image' && <ImageController  currentConfig={currentConfig}/>}
        {currentConfig.type === 'react-component' && <ReactComponentController currentConfig={currentConfig} />}
      </Suspense>

      {(instructionLocation === 'belowStimulus' || (instructionLocation === undefined && !instructionInSideBar)) && <ReactMarkdownWrapper text={instruction} />}
      <ResponseBlock
        key={`${currentStep}-below-response-block`}
        status={status}
        config={currentConfig}
        location="belowStimulus"
      />
    </>
  );
}
