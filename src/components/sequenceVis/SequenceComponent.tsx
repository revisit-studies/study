import { useMemo } from 'react';
import { animated } from 'react-spring';
import { IconArrowsShuffle, IconDice } from '@tabler/icons-react';
import { Tooltip } from '@mantine/core';
import { Arrows, TraversedSequence } from './types';
import { AnimatedArrow } from './AnimatedArrow';
import { AnimatedCircle } from './AnimatedCircle';
import { AnimatedRect } from './AnimatedRect';

const DISTANCE_BETWEEN_VERT = 50;
const CIRCLE_SIZE = 5;
const RECT_HEIGHT = 30;
const WIDTH_LIMIT_FOR_ICONS = 50;
const WIDTH_LIMIT_FOR_TEXT = 150;

const ICON_HEIGHT = 20;

export function SequenceComponent({
  components, arrows,
} : {components : TraversedSequence[], arrows: Arrows[]}) {
  const shapes = useMemo(() => (
    components.map((comp, i) => {
      if (typeof comp.component === 'string') {
        return <AnimatedCircle id={comp.id} key={comp.id} cx={comp.start} cy={DISTANCE_BETWEEN_VERT * comp.depth} r={CIRCLE_SIZE} fill={comp.active ? 'cornflowerblue' : 'lightgray'} />;
      }

      return (

        <Tooltip withinPortal withArrow key={comp.id} label={comp.id}>
          <g key={comp.id}>
            <AnimatedRect width={comp.width} x={comp.start} y={(DISTANCE_BETWEEN_VERT * comp.depth) - (RECT_HEIGHT / 2)} height={RECT_HEIGHT} fill={comp.active ? 'cornflowerblue' : 'lightgray'} />
            {comp.width > WIDTH_LIMIT_FOR_ICONS ? <IconDice x={comp.start + comp.width - 30} y={(DISTANCE_BETWEEN_VERT * comp.depth) - (ICON_HEIGHT / 2)} height={ICON_HEIGHT} /> : null}
            {comp.width > WIDTH_LIMIT_FOR_TEXT && comp.component.numSamples ? <text fontWeight={700} fontSize={14} x={comp.start + comp.width - 60} y={(DISTANCE_BETWEEN_VERT * comp.depth) + 4}>{`${comp.component.numSamples} / ${comp.component.components.length}`}</text> : null }
            {comp.width > WIDTH_LIMIT_FOR_TEXT ? <text fontSize={14} x={comp.start + 3} y={(DISTANCE_BETWEEN_VERT * comp.depth) + 4}>{comp.id}</text> : null }

          </g>
        </Tooltip>
      );
    })
  ), [components]);

  const arrowLines = useMemo(() => arrows?.map((arrow, i) => <AnimatedArrow key={i} x1={arrow.x1} x2={arrow.x2} y1={DISTANCE_BETWEEN_VERT * arrow.topDepth} y2={DISTANCE_BETWEEN_VERT * (arrow.topDepth + 1)} />), [arrows]);

  return (
    <g>
      <g>{shapes}</g>
      {/* <g>{arrowLines}</g> */}
    </g>
  );
}
