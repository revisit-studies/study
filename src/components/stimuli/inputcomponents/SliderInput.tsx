import {Group, Radio, Slider, Text, TextInput} from '@mantine/core';
import {Option} from '../../../parser/types';

export type sliderProps = {
    label:string,
    value:number,
}

type inputProps = {
    title: string,
    desc: string,
    sliderData?: Option[],
    answer:object;
    required: boolean;
}

export default function SliderInput({ title='Your Question', desc='additional description', sliderData=[], answer,required }: inputProps) {
    return (
        <>
            <Text fz={'md'} fw={500}>{title}</Text>
            <Text fz={'sm'} fw={400} c={'#868e96'}>{desc}</Text>
            <Slider
                labelAlwaysOn
                sx={{marginTop: '5px',marginBottom: '30px'}}
                marks={sliderData as sliderProps[]}
                {...answer}
                styles={(theme) =>({

                    mark: {
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        transform: 'translateX(-3px) translateY(-2px)',
                    },
                    markFilled: {
                        borderColor: theme.colors.blue[6],
                    },
                    markLabel: { fontSize: theme.fontSizes.sm, marginBottom: 5, marginTop: 0 },
                    thumb: {
                        height: 24,
                        width: 24,
                        backgroundColor: theme.white,
                        borderWidth: 1,
                        boxShadow: theme.shadows.sm,
                    },
                    label: {
                        top: -4,
                        height: 28,
                        lineHeight: 28,
                        width: 28,
                        padding: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontWeight: 700,
                        color:'orange',
                        backgroundColor: 'transparent',
                    },
                })}
            />
        </>
    );
}
