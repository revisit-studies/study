import { useState } from "react";
import { TextInput} from "@mantine/core";

type inputProps = {
    placeholder: string,
    label: string,
    updateAnswerInParent: (answer: string) => void,
}

export default function StringInput({ placeholder="", label="", updateAnswerInParent=(answer) => { } }: inputProps) {
    const [answer, setAnswer] = useState("");

    return (
        <>
            <TextInput
                placeholder={placeholder}
                label={label}
                value={answer}
                onChange={(e)=>{setAnswer(e.currentTarget.value); updateAnswerInParent(e.currentTarget.value)}}
                radius={"lg"}
                size={"md"}
            />
        </>
    );
};
