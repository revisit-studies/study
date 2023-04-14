import { Response } from "../../../parser/types";
import { TrialResult } from "../../../store";
import TextInput from "../../stimuli/inputcomponents/TextInput";
import DropdownInput from "./DropdownInput";
import NumericInput from "./NumericInput";
import RadioInput from "./RadioInput";

type Props = {
  response: Response;
  status: TrialResult;
};

export default function ResponseSwitcher({ response }: Props) {
  const { type, desc, prompt, options, required } = response;

  if (!type) return null;

  return (
    <>
      {type === "short-text" && (
        <TextInput placeholder={desc} label={prompt} required={required} />
      )}
      {type === "dropdown" && (
        <DropdownInput
          title={prompt}
          placeholder={desc}
          dropdownData={options}
        />
      )}
      {type === "radio" && (
        <RadioInput title={prompt} desc={desc} radioData={options} />
      )}
      {type === "numeric" && (
        <NumericInput label={prompt} placeholder={desc} required={required} />
      )}
      {/*{props.type.includes("slider") && <SliderInput title={title} desc={desc} sliderData={data as sliderProps[]}/>}*/}
    </>
  );
}
