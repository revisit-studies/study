import { useState, forwardRef, type Ref } from "react";
import {Group, Radio, Select, TextInput} from "@mantine/core";
import {Option} from "../../../parser/types";



type inputProps = {
    title: string,
    placeholder: string,
    dropdownData?: Option[],
    answer:object;

}

export default function DropdownInput({ title="Your Question", placeholder="additional description", dropdownData=[] , answer}: inputProps) {
    return (
        <>
            <Select
                label={title}
                placeholder={placeholder}
                data={dropdownData}
                {...answer}
            />
        </>
    );
};
