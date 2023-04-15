import { useState, forwardRef, type Ref } from "react";
import {Group, Radio, TextInput} from "@mantine/core";
import {Option} from "../../../parser/types";


type inputProps = {
    title: string,
    desc: string,
    radioData?: Option[],
    answer:object;

}

export default function RadioInput({ title="Your Question", desc="additional description", radioData=[], answer }: inputProps) {
    return (
        <>
            <Radio.Group
                name="radioInput"
                label={title}
                description={desc}
                {...answer}
            >
                <Group mt="xs">
                    {
                        radioData.map((radio) => {
                            return (
                                <Radio value={radio.value} label={radio.label} />
                            )
                        })
                    }

                </Group>
            </Radio.Group>
        </>
    );
};
