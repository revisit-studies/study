/* eslint-disable no-plusplus */
import * as d3 from 'd3';
import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';

export default function Windflow({ v } : { v: number }) {
  const d3Container = useRef(null);

  const generateDashArray = (speed: number, baseLen: number, baseInterval: number) => {
    const dasharrs = [];
    for (let i = 0; i < speed; i++) {
      let dasharr = '';
      for (let j = 0; i < 5 + Math.random() * 5; j++) {
        // dash length
        dasharr += baseLen * speed;
        dasharr += ' ';
        // dash gap length, should have randomization
        dasharr += baseInterval + (150 - Math.random() * speed);
        dasharr += ' ';
      }
      dasharrs.push(dasharr);
    }

    return dasharrs;
  };
  const createChart = () => {
    const width = 300;
    const height = 300;

    const data = v > 0 ? v : 0;

    // for test
    // data = 120

    /// /////////////Params//////////////////////////////
    const flowWidth = 50; // the width of flow band
    const baseLen = 0.2; // dash len is baseLen*speed
    const baseInterval = 10; // base interval between dash. the larger the speed, the less the interval
    // condition: triple encoding
    const dasharrays = generateDashArray(data, baseLen, baseInterval); // length encoding
    const density = data; // No of lines, density encoding
    const opacity = 0.1 + data / 200; // color encoding

    // condition single encoding
    // const dasharrays = this.generateDashArray(90,baseLen,baseInterval) // length encoding
    // const density = 80 //No of lines, density encoding
    // const opacity = 0.1 + 80/200 //color encoding

    const dashoffset = -100; // base animation moving unit(affect updating frequency)

    const gap = flowWidth / density;
    const initY = 10 + Math.random() * 140;

    // since the unique way how we make the animation, dash array is the length, not path length
    // Len(dashoffset) = duration * data(speed)
    // So the it can read as in duration(time) move dashoffset(px)
    const duration = 1000 * (Math.abs(dashoffset) / data);
    /// /////////////////////////////////////////////

    const svg = select(d3Container.current);
    svg.selectAll('*').remove();

    /// ////////////////////////////////////CURVED/////////////////////////////////
    svg
      .attr('width', width)
      .attr('height', height)
      .style('background-color', 'grey');

    // data prepare

    /// ////////////////////////////////////////////////////

    for (let i = 0; i < density; i++) {
      const offsetArray: number[] = [];

      const Y = initY + gap * i;
      const linePath = d3.line()([[0, Y], [300, Y]]);
      // const testP = d3.path();
      // // testP.arc(100,0,120,0,3.14)
      // testP.arc(100,100,100,0,3.14)

      const flows = svg
        .append('path')
        .attr('stroke', 'white')
        .attr('fill', 'none')
        .attr('stroke-width', 2)
        .attr('d', linePath)
        .attr('class', 'flowline')
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', dasharrays[i])
      // Set the intial starting position so that only the gap is shown by offesetting by the total length of the line
        .attr('stroke-dashoffset', (d, index) => {
          const offset = Math.random() * 100;
          offsetArray[index] = offset;
          return offset;
        })
        .attr('opacity', opacity);

      const curveanimate = (selection: d3.Selection<SVGPathElement, unknown, null, undefined>) => {
        const offarray = offsetArray;
        selection
          .transition()
          .duration(duration)
          .ease(d3.easeLinear)
          .attr('stroke-dasharray', dasharrays[i])
          .attr('stroke-dashoffset', (d, index) => {
            offarray[index] += dashoffset;
            return offarray[index];
          })
        // //Make some fade flow
          .attr('opacity', () => {
            const r = Math.floor(Math.random() * 100);
            if (r % 4 === 0) return 0;
            return opacity;
          })

          .on('end', () => { curveanimate(selection); });
      };
      // if(withMotion)
      flows.call(curveanimate);
    }
  };

  useEffect(() => {
    createChart();
  }, [v]);
  return (
    <svg
      className="d3-component"
      width={300}
      height={300}
      ref={d3Container}
    />
  );
}
