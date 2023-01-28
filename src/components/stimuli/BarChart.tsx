import { useChartDimensions } from "./hooks/useChartDimensions";
import * as d3 from "d3";

import PropTypes from "prop-types";
const chartSettings = {
  marginBottom: 40,
  marginLeft: 40,
  marginTop: 15,
  marginRight: 15,
  height: 400,
  width: 400,
};
const BarChart = () => {
  const tickLength = 6;
  const [ref, dms] = useChartDimensions(chartSettings);

  const xScale = d3
    .scaleBand()
    .domain(["A", "B", "C", "D", "E"])
    .range([0, dms.boundedWidth])
    .padding(0.2);

  const yScale = d3.scaleLinear().domain([100, 0]).range([0, dms.boundedWidth]);

  return (
    <div className="Chart__wrapper" ref={ref} style={{ height: "400" }}>
      <svg width={dms.width} height={dms.height}>
        <g transform={`translate(${[dms.marginLeft, dms.marginTop].join(",")})`}>
          <g transform={`translate(${[tickLength, dms.boundedHeight].join(",")})`}>
            <text>bars will be here.</text>
          </g>
          <g transform={`translate(${[0, 0].join(",")})`}>
  
          </g>
          <g transform={`translate(${[0, 0].join(",")})`}>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default BarChart;
