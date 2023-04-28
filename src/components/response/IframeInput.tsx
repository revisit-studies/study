import {List, NumberInput} from '@mantine/core';

type inputProps = {
    desc: string,
    label: string,
    required: boolean,
    answer:Array<string>;

}
export default function IframeInput({ desc='', label='' ,required=false, answer}: inputProps) {
    return (
        <>
            <List>
                {answer.map((item)=><List.Item> {item}</List.Item>)}
            </List>
        </>
    );
}
