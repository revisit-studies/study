import { lazy, Suspense, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import * as core from "@mantine/core";

import { TrialsComponent } from "../parser/types";
import TextInput from "../components/stimuli/inputcomponents/TextInput";

import { useDispatch } from "react-redux";
import { saveAnswer } from '../store/'
import {RadioIcon} from "@mantine/core/lib/Radio/RadioIcon";
import RadioInput from "../components/stimuli/inputcomponents/RadioInput";
import SliderInput from "../components/stimuli/inputcomponents/SliderInput";
import DropdownInput from "../components/stimuli/inputcomponents/DropdownInput";

export default function Trials({
  goToNextSection,
  currentStudySectionConfig,
}: {
  goToNextSection: () => void;
  currentStudySectionConfig: TrialsComponent;
}) {
  const dispatch = useDispatch();
  const [stimuliIndex, setStimuliIndex] = useState(0);

  const stimuliSequence = useMemo(() => {
    return currentStudySectionConfig.order;
  }, [currentStudySectionConfig]);

  // current active stimuli presented to the user
  const stimulusID = stimuliSequence[stimuliIndex];
  const stimulus = currentStudySectionConfig.trials[stimulusID];

  const goToNext = () => {
    if (inputRef.current !== null) {
      dispatch(saveAnswer({ [stimulusID]: inputRef.current.value }));

      if (isLastStimulus) {
        goToNextSection()
      } else {
        setStimuliIndex(stimuliIndex + 1);
        inputRef.current.value = '';
      }
    }
  };

  const inputRef = useRef<null | HTMLInputElement>(null);

  const isLastStimulus = stimuliIndex === stimuliSequence.length - 1;

  const StimulusComponent = lazy(() => import(/* @vite-ignore */`../components/${stimulus.stimulus.path}`));

  return (
    <div>
    <ReactMarkdown>{stimulus.instruction}</ReactMarkdown>
      <Suspense fallback={<div>Loading...</div>}>
        <StimulusComponent parameters={stimulus.stimulus.parameters} />
        <TextInput placeholder={"The answer is range from 0 - 100"} label={"Your answer"} ref={inputRef}/>
        <RadioInput title={"Your answer"} ref={inputRef} desc={"desc"} radioData={[{label: "lable1",value: "1"},{label:"label2",value:"2"}]}/>
        <SliderInput title={"Your answer"} ref={inputRef} desc={"desc"} sliderData={[{label: "lable1",value: 1},{label:"label2",value:100}]}/>
        <DropdownInput title={"Your answer"} ref={inputRef} placeholder={"The answer is range from 0 - 100"} dropdownData={[{label: "lable1",value: "1"},{label:"label2",value:"2"}]}/>


      </Suspense>
      
      <core.Group position="right" spacing="xs" mt="xl">
        <core.Button onClick={goToNext}>Next</core.Button>
      </core.Group>
    </div>
  );
}
