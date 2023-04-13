import { useState, forwardRef, type Ref } from "react";
import { TextInput} from "@mantine/core";

type inputProps = {
    placeholder: string,
    label: string,
}

export default forwardRef(function StringInput({ placeholder="", label="" }: inputProps, ref: Ref<HTMLInputElement>) {
    return (
        <>
            <TextInput
                ref={ref}
                placeholder={placeholder}
                label={label}
                radius={"lg"}
                size={"md"}
            />
        </>
    );
});
