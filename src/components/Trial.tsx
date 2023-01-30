import { lazy, Suspense, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import * as core from "@mantine/core";

import { TrialsComponent } from "../parser/types";

export default function Trials({
  goToNextSection,
  currentStudySectionConfig,
}: {
  goToNextSection: () => void;
  currentStudySectionConfig: TrialsComponent;
}) {
  const [stimuliIndex, setStimuliIndex] = useState(0);

  const stimuliSequence = useMemo(() => {
    // TODO: determine trial sequence by order or by randomization
    return currentStudySectionConfig.order;
  }, [currentStudySectionConfig]);

  // current active stimuli presented to the user
  const stimulus = currentStudySectionConfig.trials[stimuliSequence[stimuliIndex]];

  const showNextStimuli = () => {
    setStimuliIndex(stimuliIndex + 1);
  };

  const isLastStimulus = stimuliIndex === stimuliSequence.length - 1;

  // TODO: is there a better way to do this?
  const StimulusComponent = lazy(() => import(/* @vite-ignore */`${stimulus.stimulus.path}`));

  return (
    <div>
      <ReactMarkdown>{stimulus.instruction}</ReactMarkdown>
      <Suspense fallback={<div>Loading...</div>}>
        <StimulusComponent />
        <div>Placeholder for input. read config</div>
      </Suspense>
      
      <core.Group position="right" spacing="xs" mt="xl">
        {isLastStimulus ? (
          <core.Button onClick={goToNextSection}>Next Section</core.Button>
        ) : (
          <core.Button onClick={showNextStimuli}>Next Stimuli</core.Button>
        )}
      </core.Group>
    </div>
  );
}
