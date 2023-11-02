
import {Text} from '@mantine/core';
import { StimulusParams } from '../../../store/types';
import Bar from './Bar';
import { carsData } from './cars';
import { useResizeObserver } from '@mantine/hooks';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Scatter() {

    const [ ref, { height, width } ] = useResizeObserver();

    console.log(height, width);

    return (
        <svg ref={ref} style={{height: '100%', width: '100%'}}>

        </svg>
    );
}

export default Scatter;