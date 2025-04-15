import { Text, Tooltip } from '@mantine/core';

import { useCallback, useMemo } from 'react';
import { useMatrixContext } from '../utils/MatrixContext';

export function DestinationAxis({ showLines = true }: { showLines?: boolean }) {
  const {
    margin,
    destinationScale,
    originScale,
    answerNodes,
    setAnswerNodes,

    orderNode,

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
    (node: string, nodes: string[]) => {
      let newNodes;
      if (nodes.includes(node)) {
        newNodes = nodes.filter((n) => n !== node);
      } else {
        newNodes = [...nodes, node];
      }
      setAnswerNodes(newNodes);
      trrack?.apply('Set Answer', actions?.setAnswerNodes(newNodes));
      setAnswer({
        status: true,
        provenanceGraph: trrack?.graph.backend,
        answers: { answerNodes: newNodes },
      });
    },
    [setAnswerNodes, setAnswer, trrack, actions],
  );

  const onMouseOver = useCallback(
    (node: string, oNode: string | null) => {
      setDestinationHighlight(node);
      if (!oNode) setOriginHighlight(node);
      else setOriginHighlight(null);
    },
    [setDestinationHighlight, setOriginHighlight],
  );

  return (
    <>
      {showLines ? (
        <path className="axis-line" d={['M', 0, 0, 'H', originRange[1]].join(' ')} />
      ) : null}

      {ticks.map(({ value, offset }) => (
        <g key={`${value}`} transform={`translate(0, ${offset})`} style={{ cursor: 'pointer' }}>
          {showLines ? (
            <line
              className="axis-line"
              x2={`${-(originRange[0] - originRange[1])}`}
              y2={tickLineOffset}
              y1={tickLineOffset}
            />
          ) : null}
          <foreignObject
            x={-margin.left}
            y={-tickLineOffset}
            width={margin.left}
            height={destinationScale.bandwidth()}
            style={{ cursor: 'pointer' }}
            onClick={() => (setAnswer ? onClick(value, answerNodes) : {})}
            onMouseOver={() => onMouseOver(value, orderNode)}
          >
            <div className="label-container" style={{ justifyContent: 'flex-end' }}>
              <Tooltip
                transitionProps={{ transition: 'slide-right', duration: 300 }}
                label={value}
                withinPortal
                openDelay={200}
              >
                <Text
                  className={`axis-label${answerNodes.includes(value) ? ' selected-answer' : ''}`}
                  style={{
                    textAlign: 'start',
                  }}
                  size="s"
                >
                  {value}
                </Text>
              </Tooltip>
            </div>
          </foreignObject>
        </g>
      ))}
    </>
  );
}
