import { useState, forwardRef, type Ref } from "react";
import {Textarea, TextInput} from "@mantine/core";

type inputProps = {
    placeholder: string,
    label: string,
    required: boolean,
    answer:object;

}

export default function TextAreaInput({ placeholder="", label="" ,required, answer}: inputProps ) {
    return (
        <>
            <Textarea
                placeholder={placeholder}
                label={label}
                radius={"md"}
                size={"md"}
                withAsterisk={required}
            />
        </>
    );
};
