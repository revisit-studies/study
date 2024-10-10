import * as d3 from 'd3';
import {
  useCallback, useRef,
} from 'react';
import { StimulusParams } from '../../../../store/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ClickCircle({ parameters, setAnswer }: StimulusParams<any>) {
  const { taskid, cx, cy } = parameters;
  const ref = useRef(null);

  const clickCallback = useCallback((e: React.MouseEvent) => {
    // calculate the distance between click and circle center
    const circle = d3.select('#Circle');
    const svg = d3.select('#click_svg');
    const pointer = d3.pointer(e, svg.node());
    const circelPos = [+circle.attr('cx'), +circle.attr('cy')];
    const distance = `${Math.round(Math.sqrt((pointer[0] - circelPos[0]) ** 2 + (pointer[1] - circelPos[1]) ** 2))}px`;

    setAnswer({
      status: true,
      answers: {
        [taskid]: distance,
      },
    });
  }, [setAnswer, taskid]);

  return (
    <div className="Chart__wrapper" ref={ref} onClick={clickCallback} style={{ height: '650px' }}>
      <svg id="click_svg" width={400} height={400}>
        <circle id="Circle" cx={cx} cy={cy} r="10" stroke="black" strokeWidth="2" fill="white" />
      </svg>
    </div>

  );
}

export default ClickCircle;
