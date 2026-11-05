import {
  useEffect, useRef, useState,
} from 'react';
import { useStudyState } from '../../../store/hooks/useStudyState';
import { Button, Tooltip } from '@mantine/core';
import * as d3 from 'd3';
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
  useTrrack,
}: StimulusParams<MapParameters, MapState>) {
  const svgRef = useRef<SVGSVGElement>(null);

  const [savedSelected] = useStudyState<string[]>({ responseId: 'selectedStates', initialState: [] });
  const [savedHovered] = useStudyState({ responseId: 'hoveredState', initialState: '' });
  const trrack = useTrrack({ initialState: { ...initialState, selectedStates: savedSelected, hoveredState: savedHovered }, registry });
  const restoredState = useStudyState({ trrack });
  const [data, setData] = useState<CsvRow[] | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>(
    provenanceState?.selectedStates ?? restoredState.selectedStates,
  );
  const [hoveredState, setHoveredState] = useState<string>(
    provenanceState?.hoveredState ?? restoredState.hoveredState,
  );

  // Sync selected states to trrack
  useEffect(() => {
    if (!provenanceState && JSON.stringify(trrack.getState().selectedStates) !== JSON.stringify(selectedStates)) {
      trrack.apply('select', selectStateAction(selectedStates));
    }
  }, [selectedStates, trrack, provenanceState]);

  // Sync hovered state to trrack
  useEffect(() => {
    if (!provenanceState && trrack.getState().hoveredState !== hoveredState) {
      trrack.apply('hover', hoverStateAction(hoveredState));
    }
  }, [hoveredState, trrack, provenanceState]);

  useEffect(() => {
    setAnswer({
      status: selectedStates.length === 3,
      answers: { selectedStates, hoveredState },
    });
  }, [selectedStates, hoveredState, setAnswer]);

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
  }, [selectedStates, data]);

  // Highlight hovered state
  useEffect(() => {
    applyHoverStyles(d3.select(svgRef.current), hoveredState, selectedStates);
  }, [hoveredState, selectedStates, data]);

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
