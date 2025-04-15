/* eslint-disable camelcase, @typescript-eslint/no-explicit-any */

import { useMemo, useState, useEffect } from 'react';
import * as d3 from 'd3';
import {
  optimal_leaf_order, distance, pca_order, permute,
} from 'reorder.js';
import { useResizeObserver } from '@mantine/hooks';
import {
  Button, NativeSelect, Slider, Stack, Text,
} from '@mantine/core';
import { Trrack } from '@trrack/core';
import { ChartParams, TrrackState, link } from './utils/Interfaces';
import { OriginAxis } from './axis/OriginAxis';
import { DestinationAxis } from './axis/DestinationAxis';
import { Background } from './Background';
import { Highlighting } from './Highlighting';
import { Legend } from './Legend';
import { MatrixProvider } from './utils/MatrixContext';
import {
  destinationAccesor,
  meanAccesor,
  originAccesor,
  snrAccesor,
  stdAccesor,
} from './utils/Accesors';
import './style.css';
import { EncodedCells } from './EncodedCells';
import { useCellScales } from './hooks/useCellScales';
import {
  ClusteringMode,
  ClusteringVar,
  ColorScheme,
  Encoding,
  UserAction,
} from './utils/EncodingsEnum';

const margin = {
  top: 100,
  left: 120,
  right: 5,
  bottom: 5,
};

function linksToMatrix(property: string, links: link[]) {
  let accesor = meanAccesor;
  if (property === 'snr') {
    accesor = snrAccesor;
  } else if (property === 'std') {
    accesor = stdAccesor;
  }
  const nodes = Array.from(
    new Set(links.flatMap(({ origin, destination }) => [origin, destination])),
  );

  const indexMap = new Map(nodes.map((node, index) => [node, index]));

  const matrix = Array.from({ length: nodes.length }, () => Array(nodes.length).fill(0));

  links.forEach((d: link) => {
    const { origin, destination } = d;
    const value = accesor(d) || 0;
    matrix[indexMap.get(origin)!][indexMap.get(destination)!] = value;
  });

  return { matrix, nodes };
}

export function getClusterOrder(ordering: string, property: string, links: link[]) {
  const { matrix, nodes } = linksToMatrix(property, links);

  let orderingFunction;
  let order;
  if (ordering === 'optimal') {
    orderingFunction = optimal_leaf_order();
    orderingFunction.distance(distance.euclidean);
    orderingFunction.linkage('complete');
    order = orderingFunction(matrix);
  } else {
    // let graph = reorder.mat2graph(matrix, true);
    orderingFunction = pca_order;
    order = orderingFunction(matrix);
  }

  const newOrder = permute(nodes, order);
  return newOrder;
}

export function Matrix({
  parameters,
  data,
  provenanceState,
  actions,
  trrack,
  setAnswer,
}: {
  parameters: ChartParams;
  data: link[];

  provenanceState?: TrrackState;
  actions?: any;
  trrack?: Trrack<TrrackState, string>;
  setAnswer?: any;
}) {
  const [answerNodes, setAnswerNodes] = useState<string[]>([]);

  const [isSnr, setIsSnr] = useState<boolean>(parameters.isSnr ?? false);
  const [encoding, setEncoding] = useState<string>(parameters.encoding ?? 'simple');
  const [clusterMode, setClusterMode] = useState<string>(parameters.clusterMode ?? 'none');
  const [clusterVar, setClusterVar] = useState<string>(parameters.clusterVar ?? 'mean');

  const [colorScale, setColorScale] = useState<string>(parameters.colorScale ?? 'viridis');

  const [nMeans, setNMeans] = useState<number>(parameters.nMeans ?? 5);
  const [nDevs, setNDevs] = useState<number>(parameters.nDevs ?? 5);

  const [orderedOrigins, setOrderedOrigins] = useState<string[] | null>(null);
  const [orderedDestinations, setOrderedDestinations] = useState<string[] | null>(null);

  const [orderNode, setOrderNode] = useState<string | null>(null);

  const [destinationHighlight, setDestinationHighlight] = useState<string | null>(null);
  const [originHighlight, setOriginHighlight] = useState<string | null>(null);

  // --------------------------- Replay ----------------------------
  useEffect(() => {
    if (provenanceState?.originHighlight) {
      setOriginHighlight(provenanceState.originHighlight);
    }
  }, [provenanceState?.originHighlight]);

  useEffect(() => {
    if (provenanceState?.destinationHighlight) {
      setOriginHighlight(provenanceState?.destinationHighlight);
    }
  }, [provenanceState?.destinationHighlight]);

  useEffect(() => {
    if (provenanceState?.answerNodes) {
      setAnswerNodes(provenanceState.answerNodes);
    }
  }, [provenanceState?.answerNodes]);

  // ---------------------------- Setup ----------------------------

  /// ////////// Setting sizing

  const [ref, { width, height }] = useResizeObserver();
  const size = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom);
  const shouldRender = !Number.isNaN(size) && size > 0;
  /// ////////// Setting scales

  const origins = useMemo(
    () => orderedOrigins || [...new Set(data.map(originAccesor))].sort(),
    [data, orderedOrigins],
  );

  const destinations = useMemo(
    () => orderedDestinations || [...new Set(data.map(destinationAccesor))].sort(),
    [data, orderedDestinations],
  );

  const originScale = useMemo(() => d3.scaleBand([0, size]).domain(origins), [size, origins]);

  const destinationScale = useMemo(
    () => d3.scaleBand().range([0, size]).domain(destinations),
    [size, destinations],
  );

  const cellSize = useMemo(() => originScale.bandwidth(), [originScale]);

  const devAccesor = isSnr ? snrAccesor : stdAccesor;

  const { meanMin, meanMax } = useMemo(() => {
    const means = data.map(meanAccesor);
    return { meanMin: Math.min(...means), meanMax: Math.max(...means) };
  }, [data]);

  const { devMin, devMax } = useMemo(() => {
    const devs = data.map(devAccesor);
    return { devMin: Math.min(...devs), devMax: Math.max(...devs) };
  }, [data, devAccesor]);

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

  // ---------------------------- Cluster ----------------------------

  useEffect(() => {
    if (data.length > 1) {
      let order;
      if (clusterMode === 'none') {
        order = null;
      } else {
        order = getClusterOrder(clusterMode, clusterVar, data);
      }
      setOrderedOrigins(order);
      setOrderedDestinations(order);
    }
  }, [data, clusterMode, clusterVar]);

  // ---------------------------- Render ----------------------------
  return (
    <MatrixProvider
      context={{
        data,
        margin,
        width,
        height,
        size,
        cellSize,

        colorScale,

        nMeans,
        nDevs,

        meanMin,
        meanMax,
        devMin,
        devMax,

        originScale,
        destinationScale,

        encoding,
        setEncoding,
        isSnr,
        setIsSnr,

        originHighlight,
        setOriginHighlight,
        destinationHighlight,
        setDestinationHighlight,

        orderedOrigins,
        setOrderedOrigins,
        orderedDestinations,
        setOrderedDestinations,

        meanScale,
        devScale,

        orderNode,
        setOrderNode,

        answerNodes,
        setAnswerNodes,

        actions,
        trrack,
        setAnswer,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
        {parameters.showConfig && (
          <Stack gap="2vh">
            <NativeSelect
              label="Color scale:"
              value={colorScale}
              onChange={(event) => setColorScale(event.currentTarget.value)}
              data={Object.values(ColorScheme)}
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
              <Slider min={2} max={7} value={nMeans} onChange={setNMeans} />
            </Stack>

            <Stack gap="0.2vh">
              <Text size="sm">
                Deviation Steps:
                {nDevs}
              </Text>
              <Slider min={2} max={7} value={nDevs} onChange={setNDevs} />
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
              <EncodedCells data={data} />
              <g id="axes">
                <OriginAxis parameters={parameters} />
                <DestinationAxis />
              </g>

              <Highlighting />
              <Background />
            </g>
          )}
        </svg>
        <Stack>
          <Stack>
            <Button
              onClick={() => {
                setAnswerNodes([]);
                trrack?.apply('Set Answer', actions?.setAnswerNodes([]));
                setAnswer({
                  status: true,
                  provenanceGraph: trrack?.graph.backend,
                  answers: { answerNodes: [] },
                });
              }}
            >
              {UserAction.clearSelection}
            </Button>
            <Button
              onClick={() => {
                setOrderNode(null);
                setOrderedDestinations(orderedOrigins);
              }}
            >
              {UserAction.resetOrdering}
            </Button>
          </Stack>
          {shouldRender && <Legend />}
        </Stack>
      </div>
    </MatrixProvider>
  );
}
