import { useEffect, useState } from 'react';
import { TrrackState } from '../utils/Interfaces';

export function useReplay(provenanceState: TrrackState | undefined) {
  const [destinationHighlight, setDestinationHighlight] = useState<string | null>(null);
  const [originHighlight, setOriginHighlight] = useState<string | null>(null);

  const [orderingNode, setOrderingNode] = useState<string | null>(null);

  const [answerNodes, setAnswerNodes] = useState<string[]>([]);

  useEffect(() => {
    if (provenanceState) {
      setOrderingNode(provenanceState.orderingNode);

      setOriginHighlight(provenanceState.originHighlight);
      setDestinationHighlight(provenanceState.destinationHighlight);

      setAnswerNodes(provenanceState.answerNodes);
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
  };
}
