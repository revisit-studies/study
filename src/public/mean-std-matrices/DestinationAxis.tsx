import { Text, Tooltip } from '@mantine/core';

import { useCallback, useMemo } from 'react';
import { useMatrixContext } from './MatrixContext';

export function DestinationAxis({ showLines = true }: { showLines?: boolean }) {
  const {
    margin,
    destinationScale,
    originScale,
    answerNodes,
    setAnswerNodes,

    actions,
    trrack,
    setAnswer,

    setDestinationHighlight,
    setOriginHighlight,
  } = useMatrixContext();

  const originRange = useMemo(() => originScale.range(), [originScale]);

  const tickLineOffset = useMemo(() => destinationScale.bandwidth() / 2, [destinationScale]);

  const ticks = useMemo(
    () => destinationScale.domain().map((value) => ({
      value,
      offset: (destinationScale(value) || 0) + tickLineOffset,
    })),
    [destinationScale, tickLineOffset],
  );

  const onClick = useCallback(
    (node: string) => {
      let newNodes;
      if (answerNodes.includes(node)) {
        newNodes = answerNodes.filter((n) => n !== node);
      } else {
        newNodes = [...answerNodes, node];
      }

      setAnswerNodes(newNodes);
      trrack?.apply('Set Answer', actions?.setAnswerNodes(newNodes));
      setAnswer({
        status: true,
        provenanceGraph: trrack?.graph.backend,
        answers: { answerNodes: newNodes },
      });
    },
    [answerNodes],
  );

  const onMouseOver = useCallback(
    (node: string) => {
      setDestinationHighlight(node);
      setOriginHighlight(node);
    },
    [setDestinationHighlight, setOriginHighlight],
  );

  return (
    <>
      {showLines ? <path d={['M', 0, 0, 'H', originRange[1]].join(' ')} fill="none" stroke="lightgrey" /> : null}

      {ticks.map(({ value, offset }) => (
        <g key={`${value}`} transform={`translate(0, ${offset})`} style={{ cursor: 'pointer' }}>
          {showLines ? <line x2={`${-(originRange[0] - originRange[1])}`} stroke="lightgray" y2={tickLineOffset} y1={tickLineOffset} /> : null}
          <foreignObject
            x={-margin.left}
            y={-tickLineOffset}
            width={margin.left - 5}
            height={20}
            style={{ cursor: 'pointer' }}
            onClick={() => (setAnswer ? onClick(value) : {})}
            onMouseOver={() => onMouseOver(value)}
          >
            <Tooltip withinPortal label={value}>
              <Text
                className="answerTick"
                size="s"
                style={{
                  color: !answerNodes.includes(value) ? 'black' : 'red',
                  textAlign: 'end',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {value}
              </Text>
            </Tooltip>
          </foreignObject>
        </g>
      ))}
    </>
  );
}
