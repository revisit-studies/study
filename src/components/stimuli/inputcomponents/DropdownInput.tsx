import { useState, forwardRef, type Ref } from "react";
import {Group, Radio, Select, TextInput} from "@mantine/core";
import {Option} from "../../../parser/types";

type dropdownOpton = {
    label: string,
    value: string,
}

type inputProps = {
    title: string,
    placeholder: string,
    dropdownData?: Option[],
    answer:object,
    required: boolean,
}

export default function DropdownInput({ title="Your Question", placeholder="additional description", dropdownData=[] , required, answer}: inputProps) {
    return (
        <>
            <Select
                label={title}
                placeholder={placeholder}
                data={dropdownData as dropdownOpton[]}
                withAsterisk={required}
                {...answer}
            />
        </>
    );
};
