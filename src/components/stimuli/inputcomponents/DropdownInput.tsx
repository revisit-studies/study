import { useState, forwardRef, type Ref } from "react";
import {Group, Radio, Select, TextInput} from "@mantine/core";
import {Option} from "../../../parser/types";



type inputProps = {
    title: string,
    placeholder: string,
    dropdownData?: Option[]
}

export default forwardRef(function DropdownInput({ title="Your Question", placeholder="additional description", dropdownData=[] }: inputProps, ref: Ref<HTMLInputElement>) {
    return (
        <>
            <Select
                label={title}
                placeholder={placeholder}
                data={dropdownData}
                ref={ref}
            />
        </>
    );
});
