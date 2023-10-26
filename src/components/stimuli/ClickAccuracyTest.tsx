import * as d3 from 'd3';
import { useChartDimensions } from './hooks/useChartDimensions';
import {useEffect, useMemo, useState} from 'react';
import {updateResponseBlockValidation, useFlagsDispatch} from '../../store/flags';
import {useLocation} from 'react-router-dom';
import {Box, Slider} from '@mantine/core';
import {initializeProvenanceGraph, createAction, initializeTrrack, Registry} from '@trrack/core';

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
const ClickAccuracyTest = ({ parameters, trialId }: { parameters: any, trialId: string }) => {
  const [ref, dms] = useChartDimensions(chartSettings);
  const [x, setX] = useState(100);
  const [y, setY] = useState(100);
  const [speed, setSpeed] = useState(300);
  const flagDispatch = useFlagsDispatch();
  const id = useLocation().pathname;
  const taskid = parameters.taskid;

  const { registry, actions } = useMemo(() => {
    const reg = Registry.create();

    const click = reg.register('click', (state, click: {clickX: number, clickY: number, distance: number}) => {
        state.clickX = click.clickX;
        state.clickY = click.clickY;
        state.distance = click.distance;
        return state;
    });

    return {
        registry: reg,
        actions: {
          click
        },
    };
}, []);

  const trrack = useMemo(() => {
    return initializeTrrack({registry: registry, initialState: {distance: 0, speed: 10, clickX: 0, clickY: 0} });
  }, [registry]);


  useEffect(()=>{
    const svgElement = d3.select(ref.current);
    svgElement.on('click', function(event) {
      const clickPos = d3.pointer(event,svgElement.node());
      const circle = svgElement.select('circle');
      const circelPos = [+circle.attr('cx'), +circle.attr('cy')];
      const distance = Math.round(Math.sqrt((clickPos[0] - circelPos[0]) ** 2 + (clickPos[1] - circelPos[1]) ** 2)) + 'px';
      trrack.apply('Clicked', actions.click({distance: +distance, clickX: clickPos[0], clickY: clickPos[1]}));
      flagDispatch(
          updateResponseBlockValidation({
            location: 'sidebar',
            trialId: id,
            status: true,
            provenanceGraph: trrack.graph.backend,
            answers: {
                [`${id}/${taskid}`]: [
                ...new Set([distance]),
              ],
            },
          })
      );


    });
  },[ref]);


  useEffect(() => {
    const nxtX = Math.random() * 800;
    const nxtY = Math.random() * 600;
    const distance = Math.sqrt((nxtX - x) ** 2 + (nxtY - y) ** 2);
    const time = distance / speed *1000;
    const svgElement = d3.select(ref.current);
    svgElement.select('circle')
        .transition()
        .duration(time)
        .ease(d3.easeLinear)
        .attr('cx', nxtX)
        .attr('cy', nxtY)
        .on('end', ()=>{
          setX(nxtX);
          setY(nxtY);
        });

  },[x,y]);

  return (
      <>
          <div className="Chart__wrapper" ref={ref} style={{ height: '650px' }}>
              <svg width={dms.width} height={dms.height}>
                  <g
                      transform={`translate(${[dms.marginLeft / 2, dms.marginTop / 2].join(
                          ','
                      )})`}
                  >
                      <rect width="800" height="600" stroke="black" strokeWidth="5" fill="none"/>
                      <circle cx="100" cy="100" r="10" />

                  </g>
              </svg>
          </div>
          <Box >
              Adjust speed (px/s):
              <Slider w={800} min={10} max={1000} value={speed}  onChange={setSpeed} />

          </Box>
      </>

  );
};

export default ClickAccuracyTest;
