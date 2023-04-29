import { Suspense, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

import { Trial } from '../parser/types';

import ResponseBlock from '../components/stimuli/inputcomponents/ResponseBlock';
import { resetResponseBlockValidation, useFlagsDispatch } from '../store/flags';
import { useTrialStatus } from '../store/hooks/useTrialStatus';
import {
  TrialProvenanceContext,
  createTrialProvenance,
} from '../store/trialProvenance';
import IframeController from './IframeController';
import ImageController from './ImageController';
import ReactComponentController from './ReactComponentController';
import { useTrialsConfig } from './utils';

export const TRL_AB_STM = 'trials_aboveStimulus';
export const TRL_BLW_STM = 'trials_belowStimulus';

// current active stimuli presented to the user
export default function StimulusController({
  trialId,
  stimulus,
}: {
  trialId: string;
  stimulus: Trial;
}) {
  const trialProvenance = createTrialProvenance();
  const flagStoreDispatch = useFlagsDispatch();
  const trialStatus = useTrialStatus(trialId);

  const config = useTrialsConfig();
  const instructionAbove = config?.instructionLocation === 'aboveStimulus';

  useEffect(() => {
    flagStoreDispatch(resetResponseBlockValidation());
  });

  return (
    <div>
      {instructionAbove && (
        <ReactMarkdown>{stimulus.instruction}</ReactMarkdown>
      )}

      <TrialProvenanceContext.Provider value={trialProvenance}>
        {config && (
          <ResponseBlock
            status={trialStatus}
            config={config}
            location="aboveStimulus"
            correctAnswer={
              config.type === 'practice'
                ? stimulus.stimulus.correctAnswer
                : null
            }
          />
        )}

        <Suspense key={trialId} fallback={<div>Loading...</div>}>
          {stimulus.stimulus.type === 'website' && (
            <>
              <IframeController
                path={stimulus.stimulus.path}
                style={stimulus.stimulus.style}
              />
            </>
          )}
          {stimulus.stimulus.type === 'image' && (
            <>
              <ImageController
                path={stimulus.stimulus.path}
                style={stimulus.stimulus.style}
              />
            </>
          )}
          {stimulus.stimulus.type === 'react-component' && (
            <>
              <ReactComponentController
                stimulusID={trialId}
                stimulus={stimulus.stimulus}
              />
            </>
          )}
        </Suspense>

        {config && (
          <ResponseBlock
            status={trialStatus}
            config={config}
            location="belowStimulus"
            correctAnswer={
              config.type === 'practice'
                ? stimulus.stimulus.correctAnswer
                : null
            }
          />
        )}
      </TrialProvenanceContext.Provider>
    </div>
  );
}
