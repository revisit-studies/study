import { useState, forwardRef, type Ref } from "react";
import {Group, Radio, Slider, Text, TextInput} from "@mantine/core";
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
            <Text fz={"md"} fw={500}>{title}</Text>
            <Text fz={"sm"} fw={400} c={"#868e96"}>{desc}</Text>
            <Slider
                sx={{marginTop: "30px",marginBottom: "30px"}}
                marks={sliderData as sliderProps[]}
                {...answer}
            />
        </>
    );
};
