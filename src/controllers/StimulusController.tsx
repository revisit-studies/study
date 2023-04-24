import { Suspense } from 'react';
import ReactMarkdown from 'react-markdown';

import { Trial} from '../parser/types';
import { useCurrentStep } from '../routes';

import {
  createTrialProvenance,
  TrialProvenanceContext,
} from '../store/trialProvenance';
import IframeController from './IframeController';
import ReactComponentController from './ReactComponentController';
import ResponseBlock from '../components/stimuli/inputcomponents/ResponseBlock';
import ImageController from './ImageController';

// current active stimuli presented to the user

export default function StimulusController({trialId, stimulus}: {trialId: string, stimulus:Trial}) {
  const trialProvenance = createTrialProvenance();

  return (
    <div>
      <ReactMarkdown>{stimulus.instruction}</ReactMarkdown>
      <TrialProvenanceContext.Provider value={trialProvenance}>
        <Suspense fallback={<div>Loading...</div>}>
          <ResponseBlock location="aboveStimulus" correctAnswer={useCurrentStep().includes('practice') ? stimulus.stimulus?.correctAnswer : undefined}/>

          {stimulus.stimulus.type === 'website' && (
            <IframeController
              path={stimulus.stimulus.path}
              style={stimulus.stimulus.style}
            />
          )}
          {stimulus.stimulus.type === 'image' && (
            <ImageController
              path={stimulus.stimulus.path}
              style={stimulus.stimulus.style}
            />
          )}
          {stimulus.stimulus.type === 'react-component' && (
            <ReactComponentController
              stimulusID={trialId}
              stimulus={stimulus.stimulus}
            />
          )}

          <ResponseBlock location="belowStimulus" correctAnswer={useCurrentStep().includes('practice') ? stimulus.stimulus?.correctAnswer : undefined}/>
        </Suspense>
      </TrialProvenanceContext.Provider>
    </div>
  );
}
