import { useState, forwardRef, type Ref } from "react";
import {Checkbox, Group, NumberInput, TextInput} from "@mantine/core";
import {Option} from "../../../parser/types";

type inputProps = {
    desc: string,
    label: string,
    required: boolean,
    checkboxData?: Option[]
}

export default forwardRef(function CheckBoxInput({ desc="", label="" ,required=false, checkboxData=[]}: inputProps, ref: Ref<HTMLInputElement>) {
    return (
        <>
            <Checkbox.Group
                label={label}
                description={desc}
                withAsterisk = {required}
            >
                <Group mt="md">
                    {
                        checkboxData.map((option)=><Checkbox value={option.value} label={option.label} />)
                    }
                </Group>
            </Checkbox.Group>
        </>
    );
});
