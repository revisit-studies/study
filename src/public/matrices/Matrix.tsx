/*  eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { useResizeObserver } from '@mantine/hooks';
import { Button } from 'antd';
import { Stack } from '@mantine/core';
import { Trrack } from '@trrack/core';
import { ChartParams, TrrackState, link } from './Interfaces';
import { OriginAxis } from './OriginAxes';
import { DestinationAxis } from './DestinationAxis';
import { Background } from './Background';
import { Highlighting } from './Highlighting';
import { EncodedCells } from './EncodedCells';
import { MatrixProvider } from './MatrixContext';
import { destinationAccesor, originAccesor } from './Accesors';

const margin = {
  top: 80,
  left: 100,
  right: 0,
  bottom: 0,
};

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

  const [isSnr, setIsSnr] = useState<boolean | null>(parameters.isSnr ? parameters.isSnr : false);
  const [encoding, setEncoding] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [orderedOrigins, setOrderedOrigins] = useState<string[] | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [orderedDestinations, setOrderedDestinations] = useState<string[] | null>(null);

  const [destinationHighlight, setDestinationHighlight] = useState<string | null>(null);
  const [originHighlight, setOriginHighlight] = useState<string | null>(null);

  // ---------------------------- Replay ----------------------------
  useEffect(() => {
    if (provenanceState?.originHighlight) {
      setOriginHighlight(provenanceState.originHighlight);
    }
  }, [provenanceState?.originHighlight]);

  useEffect(() => {
    if (provenanceState?.answerNodes) {
      setAnswerNodes(provenanceState.answerNodes);
    }
  }, [provenanceState?.answerNodes]);

  // ---------------------------- Setup ----------------------------

  /// ////////// Setting sizing

  const [ref, { width, height }] = useResizeObserver();
  const size = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom);

  /// ////////// Setting scales
  const origins = useMemo(() => orderedOrigins || data.map(originAccesor).sort(), [data, orderedOrigins]);

  const destinations = useMemo(() => orderedDestinations || data.map(destinationAccesor).sort(), [data, orderedDestinations]);

  const originScale = useMemo(() => d3.scaleBand([0, size]).domain(origins), [width, origins]);

  const destinationScale = useMemo(() => d3.scaleBand().range([0, size]).domain(destinations), [size, destinations]);

  const cellSize = useMemo(() => originScale.bandwidth(), [width, height, originScale]);

  // ---------------------------- Render ----------------------------
  return (
    <MatrixProvider
      context={{
        margin,
        width,
        height,
        size,
        cellSize,

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

        answerNodes,
        setAnswerNodes,

        actions,
        trrack,
        setAnswer,
      }}
    >
      <div style={{ display: 'flex' }}>
        <Stack>
          <Button onClick={() => setEncoding('bars')}>Bars</Button>
          <Button onClick={() => setEncoding('mark')}>Mark</Button>
          <Button onClick={() => setEncoding('size')}>Size</Button>
          <Button onClick={() => setEncoding('light')}>Light</Button>
          <Button onClick={() => setEncoding('rotation')}>Rotation</Button>
        </Stack>

        <svg ref={ref} width="100%" height="89vh" style={{ display: 'block' }}>
          <g
            id="square"
            transform={`translate(${margin.left}, ${margin.top} )`}
            onMouseLeave={() => {
              setOriginHighlight(null);
              setDestinationHighlight(null);
            }}
          >
            <Highlighting />

            <EncodedCells data={data} />

            <Background />

            <g id="axes">
              <OriginAxis />
              <DestinationAxis />
            </g>
          </g>
        </svg>
      </div>
    </MatrixProvider>
  );
}
