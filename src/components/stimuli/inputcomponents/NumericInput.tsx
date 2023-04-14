import { useState, forwardRef, type Ref } from "react";
import {NumberInput, TextInput} from "@mantine/core";

type inputProps = {
    placeholder: string,
    label: string,
    required: boolean,
    max: number,
    min: number,
}

export default forwardRef(function NumericInput({ placeholder="", label="" ,required=false,min=0,max=10}: inputProps, ref: Ref<HTMLInputElement>) {
    return (
        <>
            <NumberInput
                placeholder={placeholder}
                label={label}
                withAsterisk={required}
                min={min}
                max={max}
                ref={ref}
            />
        </>
    );
});
