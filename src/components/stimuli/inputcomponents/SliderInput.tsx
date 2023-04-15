import { useState, forwardRef, type Ref } from "react";
import {Group, Radio, Slider, TextInput} from "@mantine/core";
import {Option} from "../../../parser/types";

export type sliderProps = {
    label:string,
    value:number,
}

type inputProps = {
    title: string,
    desc: string,
    sliderData?: Option[],
    answer:object;
    required: boolean,

}

export default function SliderInput({ title="Your Question", desc="additional description", sliderData=[], answer,required }: inputProps) {
    return (
        <>
            <Slider
                marks={sliderData as sliderProps[]}
                {...answer}
            />
        </>
    );
};
