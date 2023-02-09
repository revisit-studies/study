import { lazy, Suspense, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import * as core from "@mantine/core";

import { TrialsComponent } from "../parser/types";
import TextInput from "../components/stimuli/inputcomponents/TextInput";

export default function Trials({
  goToNextSection,
  currentStudySectionConfig,
}: {
  goToNextSection: () => void;
  currentStudySectionConfig: TrialsComponent;
}) {
  const [stimuliIndex, setStimuliIndex] = useState(0);

  const stimuliSequence = useMemo(() => {
    return currentStudySectionConfig.order;
  }, [currentStudySectionConfig]);

  // current active stimuli presented to the user
  const stimulus = currentStudySectionConfig.trials[stimuliSequence[stimuliIndex]];

  const showNextStimuli = () => {
    setStimuliIndex(stimuliIndex + 1);
  };

  const isLastStimulus = stimuliIndex === stimuliSequence.length - 1;

  const StimulusComponent = lazy(() => import(/* @vite-ignore */`../components/${stimulus.stimulus.path}`));

  return (
    <div>
      <ReactMarkdown>{stimulus.instruction}</ReactMarkdown>
      <Suspense fallback={<div>Loading...</div>}>
        <StimulusComponent data={stimulus.stimulus.parameters} />
        <TextInput placeholder={"The answer is range from 0 - 100"} label={"Your answer"} />
      </Suspense>
      
      <core.Group position="right" spacing="xs" mt="xl">
        {isLastStimulus ? (
          <core.Button onClick={goToNextSection}>Next</core.Button>
        ) : (
          <core.Button onClick={showNextStimuli}>Next</core.Button>
        )}
      </core.Group>
    </div>
  );
}
