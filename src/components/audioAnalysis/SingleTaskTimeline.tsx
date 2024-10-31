import {
  useCallback, useEffect, useMemo,
} from 'react';
import { isRootNode } from '@trrack/core';
import * as d3 from 'd3';
import { Stack } from '@mantine/core';
import { useParams } from 'react-router';
import { ParticipantData } from '../../storage/types';
import { useCurrentComponent } from '../../routes/utils';
import { SingleTaskProvenance } from './SingleTaskProvenance';

const margin = {
  left: 5, top: 0, right: 5, bottom: 0,
};
export function SingleTaskTimeline({
  xScale, participantData, width, height, currentNode, setCurrentNode, playTime, setPlayTime,
} : {xScale: d3.ScaleLinear<number, number>, participantData: ParticipantData, width: number, height: number, currentNode: string | null, setCurrentNode: (node: string) => void, playTime: number, setPlayTime: (n: number, p: number) => void}) {
  const totalLength = useMemo(() => xScale.domain()[1] - xScale.domain()[0], [xScale]);

  const { index } = useParams();

  const _trialFilter = useCurrentComponent();

  const trialFilter = index ? _trialFilter : null;

  const trialName = useMemo(() => {
    if (!trialFilter || !participantData) {
      return null;
    }

    return Object.keys(participantData.answers).find((key) => key.startsWith(trialFilter)) || null;
  }, [participantData, trialFilter]);

  useEffect(() => {
    if (!trialName || !participantData) {
      return;
    }
    const provGraph = participantData.answers[trialName].provenanceGraph;

    if (!provGraph) {
      return;
    }

    const { startTime } = participantData.answers.introduction_0;

    const actualTime = startTime + playTime;

    if (!currentNode || !provGraph.nodes[currentNode]) {
      setCurrentNode(provGraph.root as string);
      return;
    }

    let tempNode = provGraph.nodes[currentNode];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (actualTime < tempNode.createdOn) {
        if (!isRootNode(tempNode)) {
          const parentNode = tempNode.parent;

          if (actualTime < provGraph.nodes[parentNode].createdOn) {
            tempNode = provGraph.nodes[parentNode];
          } else break;
        } else break;
      } else if (tempNode.children.length > 0) {
        const child = tempNode.children[0];

        if (actualTime > provGraph.nodes[child].createdOn) {
          tempNode = provGraph.nodes[child];
        } else break;
      } else break;
    }

    if (tempNode.id !== currentNode) {
      setCurrentNode(tempNode.id);
    }
  }, [currentNode, participantData, playTime, setCurrentNode, trialName]);

  const currentNodeCallback = useCallback((node: string, nodeTime: number) => {
    setPlayTime(nodeTime, (nodeTime - xScale.domain()[0]) / totalLength);

    setCurrentNode(node);
  }, [setCurrentNode, setPlayTime, totalLength, xScale]);

  const circles = useMemo(() => Object.entries(participantData.answers).filter((entry) => (trialName ? trialName === entry[0] : true)).map((entry) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [name, answer] = entry;

    return <SingleTaskProvenance key={name} taskName={name} answer={answer} height={height} currentNode={currentNode} setCurrentNode={currentNodeCallback} xScale={xScale} />;
  }), [currentNode, currentNodeCallback, height, participantData.answers, trialName, xScale]);

  return (
    <Stack>
      <svg style={{ width, height }}>
        <line stroke="black" strokeWidth={1} x1={margin.left} x2={width + margin.left} y1={height / 2} y2={height / 2} />
        {circles}
      </svg>
    </Stack>
  );
}
