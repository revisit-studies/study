import { useEffect, useState } from "react";
import { TextInput} from "@mantine/core";

type inputProps = {
    placeholder: string,
    label: string,

}
export default function StringInput({placeholder="",label="" }: inputProps) {
    const [answer, setAnswer] = useState("");

    return (
        <>
            <TextInput
                placeholder={placeholder}
                label={label}
                value={answer}
                onChange={(e)=>{setAnswer(e.currentTarget.value)}}
                radius={"lg"}
                size={"md"}
            />
        </>
    );
};
