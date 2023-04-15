import { Response } from "../../../parser/types";
import { TrialResult } from "../../../store";
import TextInput from "../../stimuli/inputcomponents/TextInput";
import DropdownInput from "./DropdownInput";
import NumericInput from "./NumericInput";
import LikertInput from "./LikertInput";
import CheckBoxInput from "./CheckBoxInput";
import RadioInput from "./RadioInput";
import TextAreaInput from "./TextAreaInput";
import SliderInput from "./SliderInput";



type Props = {
  response: Response;
  status: TrialResult;
  answer: object;
};

export default function ResponseSwitcher({ response , status, answer}: Props) {
  const { type,id, desc, prompt, options, required, preset,max,min } = response;

  if (!type) return null;

  return (
    <>
      {type === "short-text" && (
        <TextInput placeholder={desc} label={prompt} required={required} id={id} answer={answer}/>
      )}
      {type === "dropdown" && (
        <DropdownInput
          title={prompt}
          placeholder={desc}
          dropdownData={options}
          answer={answer}
        />
      )}
      {type === "radio" && (
        <RadioInput title={prompt} desc={desc} radioData={options}answer={answer} />
      )}
      {type === "numerical" && (
        <NumericInput label={prompt} placeholder={desc} required={required} answer={answer} max={max as number} min={min as number}/>
      )}
      {type === "likert" && (
          <LikertInput title={prompt} desc={desc} likertPreset={preset as string} answer={answer}/>
      )}
      {type === "checkbox" && (
          <CheckBoxInput label={prompt} desc={desc} required={required} checkboxData={options} answer={answer}/>
      )}
      {type === "long-text" && (
          <TextAreaInput placeholder={desc} label={prompt} required={required} answer={answer}/>
      )}
      {type === "slider" && <SliderInput title={prompt} desc={desc} sliderData={options} answer={answer}/>}
    </>
  );
}
