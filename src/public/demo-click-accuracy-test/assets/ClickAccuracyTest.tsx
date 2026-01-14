import * as d3 from 'd3';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Box, Slider } from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import { useChartDimensions } from '../../example-cleveland/assets/hooks/useChartDimensions';
import { StimulusParams } from '../../../store/types';

const chartSettings = {
  marginBottom: 40,
  marginLeft: 40,
  marginTop: 15,
  marginRight: 15,
  height: 650,
  width: 850,
};

interface ClickAccuracyTest {
  distance: number;
  speed: number;
  clickX: number;
  clickY: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ClickAccuracyTest({ parameters, setAnswer, provenanceState }: StimulusParams<any, { distance: number, speed: number, clickX: number, clickY: number }>) {
  const [ref, dms] = useChartDimensions(chartSettings);
  const [x, setX] = useState(100);
  const [y, setY] = useState(100);
  const [speed, setSpeed] = useState(parameters.speed);
  const { taskid } = parameters;

  useEffect(() => {
    if (provenanceState?.speed !== undefined) {
      setSpeed(provenanceState.speed);
    }
  }, [provenanceState?.speed]);

  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    const clickAction = reg.register('click', (state, click: {clickX: number, clickY: number, distance: number}) => {
      state.clickX = click.clickX;
      state.clickY = click.clickY;
      state.distance = click.distance;
      return state;
    });

    const speedAction = reg.register('speed', (state, _speed: number) => {
      state.speed = _speed;
      return state;
    });

    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        distance: 0, speed: parameters.speed, clickX: 0, clickY: 0,
      },
    });

    return {
      actions: {
        clickAction,
        speedAction,
      },
      trrack: trrackInst,
    };
  }, [parameters.speed]);

  const handleSpeedChange = useCallback((_speed: number) => {
    setSpeed(_speed);
    trrack.apply('Speed', actions.speedAction(_speed));

    setAnswer({
      status: true,
      provenanceGraph: trrack.graph.backend,
      answers: {},
    });
  }, [actions, setAnswer, trrack]);

  const clickCallback = useCallback((e: React.MouseEvent) => {
    const circle = d3.select('#movingCircle');
    const svg = d3.select('#clickAccuracySvg');
    const pointer = d3.pointer(e, svg.node());

    const circlePos = [+circle.attr('cx') + dms.marginLeft / 2, +circle.attr('cy') + dms.marginTop / 2];

    const distance = `${Math.round(Math.sqrt((pointer[0] - circlePos[0]) ** 2 + (pointer[1] - circlePos[1]) ** 2))}px`;

    trrack.apply('Clicked', actions.clickAction({ distance: +distance, clickX: pointer[0], clickY: pointer[1] }));

    setAnswer({
      status: true,
      provenanceGraph: trrack.graph.backend,
      answers: {
        [taskid]: distance,
      },
    });
  }, [actions, setAnswer, taskid, trrack, dms]);

  useEffect(() => {
    const nxtX = Math.random() * 800;
    const nxtY = Math.random() * 600;
    const distance = Math.sqrt((nxtX - x) ** 2 + (nxtY - y) ** 2);
    const time = (distance / speed) * 1000;
    const svgElement = d3.select(ref.current);
    svgElement.select('circle')
      .transition()
      .duration(time)
      .ease(d3.easeLinear)
      .attr('cx', nxtX)
      .attr('cy', nxtY)
      .on('end', () => {
        setX(nxtX);
        setY(nxtY);
      });
  }, [ref, speed, x, y]);

  return (
    <>
      <div className="Chart__wrapper" ref={ref} onClick={clickCallback} style={{ height: '650px' }}>
        <svg id="clickAccuracySvg" width={dms.width} height={dms.height}>
          <g
            transform={`translate(${[dms.marginLeft / 2, dms.marginTop / 2].join(
              ',',
            )})`}
          >
            <rect width="800" height="600" stroke="black" strokeWidth="5" fill="none" />
            <circle id="movingCircle" cx="100" cy="100" r="10" />
          </g>
        </svg>
      </div>
      <Box>
        Adjust speed (px/s):
        <Slider w={800} min={10} max={1000} value={speed} onChange={handleSpeedChange} />
      </Box>
    </>
  );
}

export default ClickAccuracyTest;
