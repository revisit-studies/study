import { useEffect, useState } from 'react';
import { TrrackState } from '../utils/Interfaces';

export function useReplayState(provenanceState: TrrackState | undefined) {
  const [answerNodes, setAnswerNodes] = useState<string[]>([]);

  const [orderingNode, setOrderingNode] = useState<string | null>(null);
  const [linkMarks, setLinkMarks] = useState<string[][]>([]);

  const [destinationHighlight, setDestinationHighlight] = useState<string | null>(null);
  const [originHighlight, setOriginHighlight] = useState<string | null>(null);

  useEffect(() => {
    if (provenanceState) {
      setAnswerNodes(provenanceState.answerNodes);

      setOrderingNode(provenanceState.orderingNode);
      setLinkMarks(provenanceState.linkMarks);

      setOriginHighlight(provenanceState.originHighlight);
      setDestinationHighlight(provenanceState.destinationHighlight);
    }
  }, [provenanceState]);

  return {
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
  };
}
