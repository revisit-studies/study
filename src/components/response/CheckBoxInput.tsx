import {Checkbox, Group} from '@mantine/core';
import {Option} from '../../parser/types';

type inputProps = {
    desc: string,
    label: string,
    required: boolean,
    checkboxData?: Option[]
    answer:object;
}

export default function CheckBoxInput({ desc='', label='' ,required=false, checkboxData=[], answer}: inputProps) {
    return (
        <>
            <Checkbox.Group
                label={label}
                description={desc}
                withAsterisk = {required}
                {...answer}
            >
                <Group mt="md">
                    {
                        checkboxData.map((option)=><Checkbox value={option.value} label={option.label} />)
                    }
                </Group>
            </Checkbox.Group>
        </>
    );
}
