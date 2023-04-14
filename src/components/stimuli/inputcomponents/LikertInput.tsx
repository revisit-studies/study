import { useState, forwardRef, type Ref } from "react";
import {Group, Radio, TextInput} from "@mantine/core";
import {Option} from "../../../parser/types";
import RadioInput from "./RadioInput";


type inputProps = {
    title: string,
    desc: string,
    likertPreset: string
}

export default forwardRef(function LikertInput({ title="Your Question", desc="additional description", likertPreset="5" }: inputProps, ref: Ref<HTMLInputElement>) {

    const radioData = [];
    for (let i = 1; i <= +likertPreset; i++) {
        radioData.push({label: `${i}`, value: `${i}`});
    }

    return (
        <>
            <RadioInput title={title} desc={desc} radioData={radioData} ref={ref}/>
        </>
    );
});
