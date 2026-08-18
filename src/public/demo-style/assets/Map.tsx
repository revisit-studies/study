import {
  useEffect, useRef, useState,
} from 'react';
import { Button, Tooltip } from '@mantine/core';
import * as d3 from 'd3';
import { StimulusParams } from '../../../store/types';
import type {
  CsvRow,
  MapParameters,
  MapState,
} from '../../demo-choropleth-map/assets/types';
import {
  applyHoverStyles,
  applySelectedStyles,
  buildColorScale,
  drawLegend,
  drawMap,
  initSvg,
} from '../../demo-choropleth-map/assets/mapUtils';

export default function Map({
  parameters,
}: StimulusParams<MapParameters, MapState>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<CsvRow[] | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [hoveredState, setHoveredState] = useState('');

  useEffect(() => {
    d3.csv(`./data/${parameters.dataset}.csv`).then((rows) => {
      setData(rows as CsvRow[]);
    });
  }, [parameters.dataset]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const { valueField } = parameters;
    const legendTitle = parameters.legendTitle ?? valueField;
    const domain: [number, number] = parameters.domain
      ?? (d3.extent(data, (datum) => parseFloat(datum[valueField] ?? '')) as [number, number]);
    const colorScale = buildColorScale(domain);
    const svg = initSvg(svgRef.current);

    svg.selectAll('*').remove();
    drawMap(
      svg,
      data,
      colorScale,
      valueField,
      setHoveredState,
      () => setHoveredState(''),
      (name) => {
        setSelectedStates((previous) => (
          previous.includes(name)
            ? previous.filter((state) => state !== name)
            : [...previous, name]
        ));
      },
    );
    drawLegend(svg, colorScale, legendTitle, domain);
  }, [data, parameters]);

  useEffect(() => {
    applySelectedStyles(d3.select(svgRef.current), selectedStates);
  }, [selectedStates]);

  useEffect(() => {
    applyHoverStyles(d3.select(svgRef.current), hoveredState, selectedStates);
  }, [hoveredState, selectedStates]);

  return (
    <div>
      <Tooltip.Floating label={hoveredState} disabled={!hoveredState}>
        <svg ref={svgRef} width="100%" height="100%" />
      </Tooltip.Floating>
      <p>
        <b>Hovered State: </b>
        {hoveredState}
      </p>
      <p>
        <b>Selected States: </b>
        {selectedStates.join(', ')}
      </p>
      <Button
        variant="light"
        onClick={() => {
          setSelectedStates([]);
          setHoveredState('');
        }}
      >
        Clear Selection
      </Button>
    </div>
  );
}
