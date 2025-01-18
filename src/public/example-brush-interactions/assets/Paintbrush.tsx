import { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { BrushParams, BrushState } from './types';

const BRUSH_SIZE = 15;

export function Paintbrush(
  {
    xScale,
    yScale,
    setBrushedSpace,
    params,
    data,
    brushState,
    isSelect = true,
  } :
    {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: any[]
        brushState: BrushState,
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setBrushedSpace: (brush: [[number | null, number | null], [number | null, number | null]], _xScale: any, _yScale: any, selType: 'drag' | 'handle' | 'clear' | null, ids?: string[]) => void,
        params: BrushParams,
        isSelect?: boolean
},
) {
  const [brushPosition, setBrushPosition] = useState<number[]>([0, 0]);
  const [isBrushing, setIsBrushing] = useState<boolean>(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = d3.select<SVGGElement, any>('#scatterSvgBrushStudy');

    if (svg) {
      const svgPos = svg.node()!.getBoundingClientRect();
      svg.on('mousemove', (e: React.MouseEvent) => {
        const pos = [e.clientX - svgPos.x, e.clientY - svgPos.y];
        setBrushPosition(pos);

        if (isBrushing) {
          const selected = data.filter((car) => Math.abs(xScale(car[params.x]) - pos[0]) < BRUSH_SIZE && Math.abs(yScale(car[params.y]) - pos[1]) < BRUSH_SIZE);

          if (e.ctrlKey || e.metaKey || !isSelect) {
            const set = new Set(brushState.ids);
            selected.forEach((sel) => {
              if (set.has(sel[params.ids])) {
                set.delete(sel[params.ids]);
              }
            });
            const newIds = Array.from(set);
            setBrushedSpace([[brushPosition[0], brushPosition[1]], [brushPosition[0], brushPosition[1]]], xScale, yScale, newIds.length === 0 ? 'clear' : 'drag', newIds);
          } else {
            const newIds = Array.from(new Set([...brushState.ids, ...selected.map((car) => car[params.ids])]));

            if (newIds.length > 0) {
              setBrushedSpace([[brushPosition[0], brushPosition[1]], [brushPosition[0], brushPosition[1]]], xScale, yScale, 'drag', newIds);
            }
          }
        }
      });

      svg.on('mousedown', (e) => {
        setIsBrushing(true);
        e.stopPropagation();
        e.preventDefault();
      });

      svg.on('mouseup', () => {
        setIsBrushing(false);
      });
    }
  }, [brushPosition, brushState.ids, data, isBrushing, isSelect, params, setBrushedSpace, xScale, yScale]);

  return (
    <circle style={{ cursor: isBrushing ? 'pointer' : 'default' }} r={BRUSH_SIZE} fill="darkgray" opacity={0.5} cx={brushPosition[0]} cy={brushPosition[1]} />
  );
}
