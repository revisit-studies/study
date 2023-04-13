import { useState, forwardRef, type Ref } from "react";
import {Group, Radio, Slider, TextInput} from "@mantine/core";

type sliderProps = {
    label:string,
    value:number,
}

type inputProps = {
    title: string,
    desc: string,
    sliderData: sliderProps[]
}

export default forwardRef(function SliderInput({ title="Your Question", desc="additional description", sliderData=[] }: inputProps, ref: Ref<HTMLInputElement>) {
    return (
        <>
            <Slider
                ref={ref}
                marks={sliderData}
            />
        </>
    );
});
