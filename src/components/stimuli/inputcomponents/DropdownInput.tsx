import { useState, forwardRef, type Ref } from "react";
import {Group, Radio, Select, TextInput} from "@mantine/core";

type dropdownProps = {
    label:string,
    value:string,
}

type inputProps = {
    title: string,
    placeholder: string,
    dropdownData: dropdownProps[]
}

export default forwardRef(function RadioInput({ title="Your Question", placeholder="additional description", dropdownData=[] }: inputProps, ref: Ref<HTMLInputElement>) {
    return (
        <>
            <Select
                label={title}
                placeholder={placeholder}
                data={dropdownData}
            />
        </>
    );
});
