/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable implicit-arrow-linebreak */

import { useMemo } from 'react';
import * as d3 from 'd3';

import { useResizeObserver } from '@mantine/hooks';
import {
  Checkbox, NativeSelect, Slider, Stack, Text,
} from '@mantine/core';

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
import { ChartParams, TrrackState, link } from '../utils/Interfaces';
import {
  destinationAccesor,
  meanAccesor,
  originAccesor,
  snrAccesor,
  stdAccesor,
} from '../utils/Accesors';
import {
  ClusteringMode, ClusteringVar, ColorScheme, Encoding, MarkColor,
} from '../utils/Enums';

import { useCellScales } from '../hooks/useCellScales';
import { useOrdering } from '../hooks/useOrdering';
import { useReplay } from '../hooks/useReplay';
import { useConfig } from '../hooks/useConfig';
import { InteractionButtons } from './InteractionButtons';
import { useCellRenderer } from '../hooks/useRenderEncodeCells';

const margin = {
  top: 100,
  left: 120,
  right: 5,
  bottom: 5,
};

const filesObj = import.meta.glob('/public/matrices/data/*');
const files = Object.keys(filesObj).map((path) => path.replace('/public/matrices/data/', ''));

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
  config: ChartParams;
  data: link[];
  dataname: string;
  setDataname: React.Dispatch<React.SetStateAction<string>>;
  provenanceState?: TrrackState;
  actions?: any;
  trrack?: Trrack<TrrackState, string>;
  setAnswer?: any;
}) {
  // --------------------------- Config ----------------------------

  const {
    colorScale,
    setColorScale,

    encoding,
    setEncoding,

    showTooltip,
    setShowTooltip,

    isSnr,
    setIsSnr,

    clusterMode,
    setClusterMode,

    clusterVar,
    setClusterVar,

    nMeans,
    setNMeans,

    nDevs,
    setNDevs,

    markColor,
    setMarkColor,
  } = useConfig(config);

  // --------------------------- Replay Items ----------------------------

  const {
    destinationHighlight,
    setDestinationHighlight,
    originHighlight,
    setOriginHighlight,
    answerNodes,
    setAnswerNodes,
    orderingNode,
    setOrderingNode,
    linkMarks,
    setLinkMarks,
  } = useReplay(provenanceState);

  // --------------------------- Ordering ----------------------------

  const {
    orderedOrigins, orderedDestinations, setOrderedOrigins, setOrderedDestinations,
  } = useOrdering(data, clusterMode, clusterVar);

  // ---------------------------- Scales ----------------------------

  const [ref, { width, height }] = useResizeObserver();
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const size = Math.max(0, Math.min(innerWidth, innerHeight));

  const origins = orderedOrigins ?? [...new Set(data.map(originAccesor))].sort();
  const destinations = orderedDestinations ?? [...new Set(data.map(destinationAccesor))].sort();

  const originScale = d3.scaleBand<string>().range([0, size]).domain(origins);
  const destinationScale = d3.scaleBand<string>().range([0, size]).domain(destinations);

  const cellSize = originScale.bandwidth();

  const devAccesor = isSnr ? snrAccesor : stdAccesor;

  const { meanMin, meanMax } = useMemo(
    () =>
      /* const means = data.map(meanAccesor); */
      ({ meanMin: 0, meanMax: 250 }),
    /* return { meanMin: Math.min(...means), meanMax: Math.max(...means) }; */
    [data],
  );

  const { devMin, devMax } = useMemo(
    () =>
      /* const devs = data.map(devAccesor); */
      ({ devMin: 0, devMax: 150 }),
    /* return { devMin: Math.min(...devs), devMax: Math.max(...devs) }; */
    [data, devAccesor],
  );

  const { meanScale, devScale } = useCellScales(
    encoding,
    colorScale,
    cellSize,
    meanMin,
    meanMax,
    devMin,
    devMax,
    isSnr,
    nMeans,
    nDevs,
  );

  // ---------------------------- Cell Renderer ----------------------------

  const cellRenderer = useCellRenderer(
    encoding,
    markColor,
    isSnr,

    meanScale,
    devScale,
    cellSize,
  );

  const shouldRender = !Number.isNaN(size) && size > 0;

  // ---------------------------- Render ----------------------------
  return (
    <MatrixProvider
      context={{
        data,

        config,

        margin,
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

        encoding,
        isSnr,
        colorScale,
        markColor,
        nMeans,
        nDevs,

        cellRenderer,

        originScale,
        destinationScale,

        originHighlight,
        setOriginHighlight,

        destinationHighlight,
        setDestinationHighlight,

        orderedOrigins,
        setOrderedOrigins,

        orderedDestinations,
        setOrderedDestinations,

        linkMarks,
        setLinkMarks,

        orderingNode,
        setOrderingNode,

        answerNodes,
        setAnswerNodes,

        actions,
        trrack,
        setAnswer,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '2vw' }}>
        {config.showConfig && (
          <Stack gap="2vh">
            <Checkbox
              label="Tooltip"
              checked={showTooltip}
              onChange={(event) => setShowTooltip(event.currentTarget.checked)}
            />
            <NativeSelect
              w={175}
              label="Data file:"
              value={dataname}
              onChange={(event) => setDataname(event.currentTarget.value)}
              data={files}
            />
            <NativeSelect
              label="Color scale:"
              value={colorScale}
              onChange={(event) => setColorScale(event.currentTarget.value)}
              data={Object.values(ColorScheme)}
            />
            <NativeSelect
              label="Mark Color:"
              value={markColor}
              onChange={(event) => setMarkColor(event.currentTarget.value)}
              data={Object.values(MarkColor)}
            />
            <NativeSelect
              label="Encoding:"
              value={encoding}
              onChange={(event) => setEncoding(event.currentTarget.value)}
              data={Object.values(Encoding)}
            />
            <NativeSelect
              label="Cluster mode:"
              value={clusterMode}
              onChange={(event) => setClusterMode(event.currentTarget.value)}
              data={Object.values(ClusteringMode)}
            />
            <NativeSelect
              label="ClusterVar:"
              value={clusterVar}
              onChange={(event) => setClusterVar(event.currentTarget.value)}
              data={Object.values(ClusteringVar)}
            />
            <Stack gap="0.2vh">
              <Text size="sm">
                Mean Steps:
                {nMeans}
              </Text>
              <Slider min={2} max={5} value={nMeans} onChange={setNMeans} />
            </Stack>
            <Stack gap="0.2vh">
              <Text size="sm">
                Deviation Steps:
                {nDevs}
              </Text>
              <Slider min={2} max={5} value={nDevs} onChange={setNDevs} />
            </Stack>
          </Stack>
        )}

        <svg ref={ref} height="89vh" style={{ display: 'block', aspectRatio: '1' }}>
          {shouldRender && (
            <g
              id="square"
              transform={`translate(${margin.left}, ${margin.top} )`}
              onMouseLeave={() => {
                setOriginHighlight(null);
                setDestinationHighlight(null);
              }}
            >
              <EncodedCells />
              <g id="axes">
                <OriginAxis />
                <DestinationAxis />
              </g>

              <Highlighting />
              <Background />

              {config.clusterMarks && <ClusterMarks size={3} marks={config.clusterMarks} />}
              <LinkMarks size={1} marks={linkMarks} />

              {showTooltip && <MatrixTooltip />}
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
