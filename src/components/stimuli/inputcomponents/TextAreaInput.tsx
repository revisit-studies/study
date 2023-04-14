import { useState, forwardRef, type Ref } from "react";
import {Textarea, TextInput} from "@mantine/core";

type inputProps = {
    placeholder: string,
    label: string,
    required: boolean,
}

export default forwardRef(function TextAreaInput({ placeholder="", label="" ,required}: inputProps, ref: Ref<HTMLInputElement>) {
    return (
        <>
            <Textarea
                placeholder={placeholder}
                label={label}
                radius={"lg"}
                size={"md"}
                withAsterisk={required}
            />
        </>
    );
});
