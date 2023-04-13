import { useState, forwardRef, type Ref } from "react";
import {Group, Radio, TextInput} from "@mantine/core";

type radioProps = {
    label:string,
    value:string,
}

type inputProps = {
    title: string,
    desc: string,
    radioData: radioProps[]
}

export default forwardRef(function RadioInput({ title="Your Question", desc="additional description", radioData=[] }: inputProps, ref: Ref<HTMLInputElement>) {
    return (
        <>
            <Radio.Group
                name="radioInput"
                label={title}
                description={desc}
                ref={ref}
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
});
