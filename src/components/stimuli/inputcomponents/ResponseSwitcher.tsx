import { Response } from "../../../parser/types";
import { TrialResult } from "../../../store";
import TextInput from "../../stimuli/inputcomponents/TextInput";
import DropdownInput from "./DropdownInput";
import NumericInput from "./NumericInput";
import LikertInput from "./LikertInput";
import CheckBoxInput from "./CheckBoxInput";
import RadioInput from "./RadioInput";
import TextAreaInput from "./TextAreaInput";



type Props = {
  response: Response;
  status: TrialResult;
};

export default function ResponseSwitcher({ response }: Props) {
  const { type, desc, prompt, options, required, preset,max,min } = response;

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
      {type === "numerical" && (
        <NumericInput label={prompt} placeholder={desc} required={required} max={max as number} min={min as number}/>
      )}
      {type === "likert" && (
          <LikertInput title={prompt} desc={desc} likertPreset={preset as string} />
      )}
      {type === "checkbox" && (
          <CheckBoxInput label={prompt} desc={desc} required={required} checkboxData={options}/>
      )}
      {type === "long-text" && (
          <TextAreaInput placeholder={desc} label={prompt} required={required}/>
      )}
      {/*{props.type.includes("slider") && <SliderInput title={title} desc={desc} sliderData={data as sliderProps[]}/>}*/}
    </>
  );
}
