import * as d3 from "d3";
import { Bubbles } from "./chartcomponents/Bubbles";
import { DotMarks } from "./chartcomponents/DotMarks";
import { useChartDimensions } from "./hooks/useChartDimensions";

const chartSettings = {
  marginBottom: 40,
  marginLeft: 40,
  marginTop: 15,
  marginRight: 15,
  height: 400,
  width: 400,
};

const createBubbleData = (
  { data }: { data: any[] },
  width = 100,
  height = 100
) => {
  const dataArr = data.map((d) => +d.value);
  const jsonData = { children: dataArr.map((d) => ({ value: d })) };
  const bubble: any = d3
    .pack()
    .size([width - 10, height - 10])
    .padding(1.5);
  const bubbleNodes = d3.hierarchy(jsonData).sum((d: any) => d.value);
  return bubble(bubbleNodes)
    .descendants()
    .filter((d: any) => !d.children);
};

const createMarkPositions = (bubbleData: any[], selected: number[]) => {
  return bubbleData.filter((d, i) => selected.includes(i));
};

const BubbleChart = ({ data }: { data: any }) => {
  const [ref, dms] = useChartDimensions(chartSettings);
  const bubbleData = createBubbleData(data, dms.width, dms.height);
  const markPositions = createMarkPositions(bubbleData, data.selectedIndices);

  return (
    <div className="Chart__wrapper" ref={ref} style={{ height: "400px" }}>
      <svg width={dms.width} height={dms.height}>
        <g
          transform={`translate(${[dms.marginLeft / 2, dms.marginTop / 2].join(
            ","
          )})`}
        >
          <Bubbles data={bubbleData} />
          <DotMarks positions={markPositions} />
        </g>
      </svg>
    </div>
  );
};

export default BubbleChart;
