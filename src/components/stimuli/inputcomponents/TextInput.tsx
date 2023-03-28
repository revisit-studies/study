import { useState, forwardRef, type Ref } from "react";
import { TextInput} from "@mantine/core";

type inputProps = {
    placeholder: string,
    label: string,
}

export default forwardRef(function StringInput({ placeholder="", label="" }: inputProps, ref: Ref<HTMLInputElement>) {
    const [answer, setAnswer] = useState("");

    return (
        <>
            <TextInput
                ref={ref}
                placeholder={placeholder}
                label={label}
                value={answer}
                onChange={(e)=>{setAnswer(e.currentTarget.value)}}
                radius={"lg"}
                size={"md"}
            />
        </>
    );
});
