import type { TrrackedProvenance } from '../../store/types';

export type ProvenanceTraversalEvent = {
  nodeId: string;
  createdOn: number;
};

export type ProvenanceReplaySelection = ProvenanceTraversalEvent & {
  fromTraversal: boolean;
};

type ReplayableProvenance = TrrackedProvenance & {
  traversalEvents?: unknown;
};

function getTraversalEvents(provenance: ReplayableProvenance): ProvenanceTraversalEvent[] {
  if (!Array.isArray(provenance.traversalEvents)) {
    return [];
  }

  return provenance.traversalEvents
    .filter((event): event is ProvenanceTraversalEvent => (
      typeof event === 'object'
      && event !== null
      && 'nodeId' in event
      && typeof event.nodeId === 'string'
      && event.nodeId in provenance.nodes
      && 'createdOn' in event
      && typeof event.createdOn === 'number'
      && Number.isFinite(event.createdOn)
    ))
    .sort((first, second) => first.createdOn - second.createdOn);
}

export function getReplaySelection(
  provenance: TrrackedProvenance,
  playTime: number,
  currentNode?: string | null,
): ProvenanceReplaySelection {
  const traversalEvents = getTraversalEvents(provenance as ReplayableProvenance);

  if (traversalEvents.length > 0) {
    let replaySelection = {
      nodeId: provenance.root as string,
      createdOn: provenance.nodes[provenance.root].createdOn,
      fromTraversal: true,
    };

    traversalEvents.forEach((event) => {
      if (event.createdOn <= playTime) {
        replaySelection = { ...event, fromTraversal: true };
      }
    });

    return replaySelection;
  }

  if (!currentNode || !provenance.nodes[currentNode]) {
    return {
      nodeId: provenance.root as string,
      createdOn: provenance.nodes[provenance.root].createdOn,
      fromTraversal: false,
    };
  }

  let replayNode = provenance.nodes[currentNode];

  while (true) {
    if (playTime < replayNode.createdOn) {
      if (replayNode.id === provenance.root || !('parent' in replayNode)) {
        break;
      }

      replayNode = provenance.nodes[replayNode.parent];
    } else if (replayNode.children.length > 0) {
      const child = provenance.nodes[replayNode.children[0]];

      if (playTime >= child.createdOn) {
        replayNode = child;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return {
    nodeId: replayNode.id,
    createdOn: replayNode.createdOn,
    fromTraversal: false,
  };
}

export function getReplayNodeId(
  provenance: TrrackedProvenance,
  playTime: number,
  currentNode?: string | null,
) {
  return getReplaySelection(provenance, playTime, currentNode).nodeId;
}
