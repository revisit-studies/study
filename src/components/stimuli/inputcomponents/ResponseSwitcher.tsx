import { useState, forwardRef, type Ref } from "react";
import TextInput from "../../stimuli/inputcomponents/TextInput";
import Consent from "../../Consent";
import {ConsentComponent, TrialsComponent} from "../../../parser/types";
import {Button, Select} from "@mantine/core";
import TrialController from "../../../controllers/TrialController";
import DropdownInput from "./DropdownInput";
import RadioInput from "./RadioInput";
import SliderInput, {sliderProps} from "./SliderInput";
import dropdownInput from "./DropdownInput";
import radioInput from "./RadioInput";
import sliderInput from "./SliderInput";
import {Response} from "../../../parser/types";
import NumericInput from "./NumericInput";

export default forwardRef(function ResponseSwitcher({id,type,desc,prompt,options,required}: Response, ref: Ref<HTMLInputElement>) {

    return (
        <>
            {type && type.includes("short-text") && <TextInput placeholder={desc} label={prompt} required={required} ref={ref}/>}
            {type && type.includes("dropdown") && <DropdownInput title={prompt} placeholder={desc} dropdownData={options} ref={ref}/>}
            {type && type.includes("radio") && <RadioInput title={prompt} desc={desc} radioData={options} ref={ref}/>}
            {type && type.includes("numeric") && <NumericInput label={prompt} placeholder={desc} required={required} ref={ref}/>}
            {/*{props.type.includes("slider") && <SliderInput title={title} desc={desc} sliderData={data as sliderProps[]}/>}*/}

        </>
);
});
