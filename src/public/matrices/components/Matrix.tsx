/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo } from 'react';
import * as d3 from 'd3';

import { useResizeObserver } from '@mantine/hooks';
import { Stack } from '@mantine/core';

import { Trrack } from '@trrack/core';

import { OriginAxis } from './axis/OriginAxis';
import { DestinationAxis } from './axis/DestinationAxis';

import { Background } from './Background';
import { Highlighting } from './Highlighting';
import { Legend } from './Legend';
import { EncodedCells } from './EncodedCells';
import { MatrixTooltip } from './Tooltip';
import { ClusterMarks, LinkMarks } from './Marks';

import { MatrixProvider } from '../utils/MatrixContext';
import { TrrackState, Link, ExternalParameters } from '../utils/Interfaces';
import { destinationAccessor, originAccessor } from '../utils/Accessors';

import { useCellScales } from '../hooks/useCellScales';
import { useOrderingState } from '../hooks/useOrdering';
import { useReplayState } from '../hooks/useReplay';
import { useConfigProps } from '../hooks/useConfig';
import { InteractionButtons } from './InteractionButtons';
import { useCellRenderer } from '../hooks/useRenderEncodeCells';
import ControlPanel from './ControlPanel';

const MARGIN = {
  top: 100,
  left: 120,
  right: 5,
  bottom: 5,
};

export function Matrix({
  config,
  data,
  dataname,
  setDataname,
  provenanceState,
  actions,
  trrack,
  setAnswer,
}: {
  config: ExternalParameters;
  data: Link[];
  dataname: string;
  setDataname: React.Dispatch<React.SetStateAction<string>>;
  provenanceState?: TrrackState;
  actions?: any;
  trrack?: Trrack<TrrackState, string>;
  setAnswer?: any;
}) {
  // --------------------------- Config ----------------------------
  const configProps = useConfigProps(config);

  // --------------------------- Replay ----------------------------
  const replayState = useReplayState(provenanceState);

  // --------------------------- Ordering ----------------------------
  const orderingState = useOrderingState(data, configProps.clusterMode, configProps.clusterVar);

  // ---------------------------- Dimensions ----------------------------
  const [ref, { width, height }] = useResizeObserver();
  const size = Math.min(width - MARGIN.left - MARGIN.right, height - MARGIN.top - MARGIN.bottom);

  // ---------------------------- Data Processing ----------------------------
  const origins = useMemo(
    () => orderingState.orderedOrigins || [...new Set(data.map(originAccessor))].sort(),
    [data, orderingState.orderedOrigins],
  );

  const destinations = useMemo(
    () => orderingState.orderedDestinations || [...new Set(data.map(destinationAccessor))].sort(),
    [data, orderingState.orderedDestinations],
  );

  // ---------------------------- Scales ----------------------------
  const originScale = useMemo(
    () => d3.scaleBand().domain(origins).range([0, size]),
    [size, origins],
  );

  const destinationScale = useMemo(
    () => d3.scaleBand().domain(destinations).range([0, size]),
    [size, destinations],
  );

  const cellSize = originScale.bandwidth();

  // ---------------------------- Value Ranges ----------------------------
  const { meanMin, meanMax } = useMemo(
    () => ({
      meanMin: 0, // d3.min(data, meanAccessor) ?? 0,
      meanMax: 250, // d3.max(data, meanAccessor) ?? 250,
    }),
    [data],
  );

  const { devMin, devMax } = useMemo(
    () => ({
      devMin: 0, // d3.min(data, configProps.isSnr ? snrAccessor : stdAccessor) ?? 0,
      devMax: 150, // d3.max(data, configProps.isSnr ? snrAccessor : stdAccessor) ?? 150,
    }),
    [data, configProps.isSnr],
  );

  // ---------------------------- Scales ----------------------------
  const { meanScale, devScale } = useCellScales(
    configProps.encoding,
    configProps.colorScheme,
    cellSize,
    meanMin,
    meanMax,
    devMin,
    devMax,
    configProps.isSnr,
    configProps.nMeans,
    configProps.nDevs,
  );

  // ---------------------------- Cell Renderer ----------------------------
  const cellRenderer = useCellRenderer(
    configProps.encoding,
    configProps.markColor,
    configProps.isSnr,
    meanScale,
    devScale,
    cellSize,
  );

  // ---------------------------- Context Value ----------------------------
  const contextValue = useMemo(
    () => ({
      data,
      width,
      height,
      size,
      margin: MARGIN,
      cellSize,
      meanMin,
      meanMax,
      devMin,
      devMax,
      meanScale,
      devScale,
      originScale,
      destinationScale,
      cellRenderer,
      configProps,
      ...replayState,
      ...orderingState,
      actions,
      trrack,
      setAnswer,
    }),
    [
      data,
      width,
      height,
      size,
      cellSize,
      meanMin,
      meanMax,
      devMin,
      devMax,
      meanScale,
      devScale,
      originScale,
      destinationScale,
      cellRenderer,
      configProps,
      replayState,
      orderingState,
      actions,
      trrack,
      setAnswer,
    ],
  );

  const shouldRender = !Number.isNaN(size) && size > 0;

  return (
    <MatrixProvider value={contextValue}>
      <div className="container">
        <ControlPanel configProps={configProps} dataname={dataname} setDataname={setDataname} />
        <svg ref={ref} className="matrix-svg">
          {shouldRender && (
            <g
              transform={`translate(${MARGIN.left},${MARGIN.top})`}
              onMouseLeave={() => {
                replayState.setOriginHighlight(null);
                replayState.setDestinationHighlight(null);
              }}
            >
              <EncodedCells />
              <g className="axes">
                <OriginAxis />
                <DestinationAxis />
              </g>
              <Highlighting />
              <Background />
              {config.clusterMarks && <ClusterMarks size={3} marks={config.clusterMarks} />}
              <LinkMarks size={1} marks={replayState.linkMarks} />
              {configProps.showTooltip && <MatrixTooltip />}
            </g>
          )}
        </svg>

        {shouldRender && (
          <Stack gap="5vh">
            <InteractionButtons />
            <Legend />
          </Stack>
        )}
      </div>
    </MatrixProvider>
  );
}
