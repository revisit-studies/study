import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { Button, Tooltip } from '@mantine/core';
import * as d3 from 'd3';
import { initializeTrrack } from '@trrack/core';

import { StimulusParams } from '../../../store/types';
import type { CsvRow, MapParameters, MapState } from './types';
import {
  initialState,
  registry,
  selectStateAction,
  hoverStateAction,
} from './trrack';
import {
  applyHoverStyles,
  applySelectedStyles,
  buildColorScale,
  drawLegend,
  drawMap,
  initSvg,
} from './mapUtils';

function Map({
  parameters,
  setAnswer,
  provenanceState,
}: StimulusParams<MapParameters, MapState>) {
  const svgRef = useRef<SVGSVGElement>(null);

  const [data, setData] = useState<CsvRow[] | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>(
    provenanceState?.selectedStates ?? [],
  );
  const [hoveredState, setHoveredState] = useState<string>(
    provenanceState?.hoveredState ?? '',
  );

  // Initialize Trrack instance
  const trrack = useMemo(
    () => initializeTrrack({ initialState, registry }),
    [],
  );

  // Sync selected states to trrack
  useEffect(() => {
    trrack.apply('select', selectStateAction(selectedStates));

    setAnswer({
      provenanceGraph: trrack.graph.backend,
      status: true,
      answers: { selectedStates },
    });
  }, [selectedStates, setAnswer, trrack]);

  // Sync hovered state to trrack
  useEffect(() => {
    trrack.apply('hover', hoverStateAction(hoveredState));

    setAnswer({
      provenanceGraph: trrack.graph.backend,
      status: true,
      answers: { hoveredState },
    });
  }, [hoveredState, setAnswer, trrack]);

  // Restore provenance state when replaying
  useEffect(() => {
    if (provenanceState) {
      setSelectedStates(provenanceState.selectedStates);
      setHoveredState(provenanceState.hoveredState);
    }
  }, [provenanceState]);

  // Load CSV data
  useEffect(() => {
    d3.csv(`./data/${parameters.dataset}.csv`).then((rows) => {
      setData(rows as CsvRow[]);
    });
  }, [parameters.dataset]);

  // Render map and legend once data and config are ready
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const { valueField } = parameters;
    const legendTitle = parameters.legendTitle ?? valueField;

    // Build domain from data when not explicitly provided
    const domain: [number, number] = parameters.domain
      ?? (d3.extent(data, (d) => parseFloat(d[valueField] ?? '')) as [
        number,
        number,
      ]);

    const colorScale = buildColorScale(domain);

    const svg = initSvg(svgRef.current);
    svg.selectAll('*').remove();

    const handleHover = (name: string) => setHoveredState(name);
    const handleHoverLeave = () => setHoveredState('');
    const handleSelect = (name: string) => {
      setSelectedStates((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
    };

    drawMap(
      svg,
      data,
      colorScale,
      valueField,
      handleHover,
      handleHoverLeave,
      handleSelect,
    );

    drawLegend(svg, colorScale, legendTitle, domain);
  }, [data, parameters]);

  // Highlight selected states
  useEffect(() => {
    applySelectedStyles(d3.select(svgRef.current), selectedStates);
  }, [selectedStates]);

  // Highlight hovered state
  useEffect(() => {
    applyHoverStyles(d3.select(svgRef.current), hoveredState, selectedStates);
  }, [hoveredState, selectedStates]);

  return (
    <div>
      <Tooltip.Floating label={hoveredState} disabled={!hoveredState}>
        <svg ref={svgRef} width="100%" height="100%" />
      </Tooltip.Floating>
      <div>
        <p>
          <b>Hovered State: </b>
          {hoveredState}
        </p>
        <p>
          <b>Selected States: </b>
          {selectedStates.join(', ')}
        </p>
      </div>
      <div>
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
    </div>
  );
}

export default Map;
