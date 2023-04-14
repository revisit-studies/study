import { useState, forwardRef, type Ref } from "react";
import {NumberInput, TextInput} from "@mantine/core";

type inputProps = {
    placeholder: string,
    label: string,
    required: boolean,
}

export default forwardRef(function NumericInput({ placeholder="", label="" ,required=false}: inputProps, ref: Ref<HTMLInputElement>) {
    return (
        <>
            <NumberInput
                placeholder={placeholder}
                label={label}
                withAsterisk={required}
                ref={ref}
            />
        </>
    );
});
