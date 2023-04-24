import {NumberInput} from '@mantine/core';

type inputProps = {
    placeholder: string,
    label: string,
    required: boolean,
    max: number,
    min: number,
    answer:object;

}
export default function NumericInput({ placeholder='', label='' ,required=false,min=0,max=10, answer}: inputProps) {
    return (
        <>
            <NumberInput
                placeholder={placeholder}
                label={label}
                withAsterisk={required}
                radius={'md'}
                size={'md'}
                min={min}
                max={max}
                {...answer}
            />
        </>
    );
}
