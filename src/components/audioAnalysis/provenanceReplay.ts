import { getProvenanceTraversalEvents } from '../../store/provenance';
import type { ProvenanceTraversalEvent, TrrackedProvenance } from '../../store/types';

export type ProvenanceReplaySelection = ProvenanceTraversalEvent & {
  fromTraversal: boolean;
};

/**
 * @deprecated Graph creation order cannot reproduce undo, redo, or arbitrary
 * traversal. Retained only for provenance recorded before traversal events.
 */
function getLegacyReplaySelection(
  provenance: TrrackedProvenance,
  playTime: number,
  currentNode?: string | null,
): ProvenanceReplaySelection {
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

export function getReplaySelection(
  provenance: TrrackedProvenance,
  playTime: number,
  currentNode?: string | null,
): ProvenanceReplaySelection {
  const traversalEvents = getProvenanceTraversalEvents(provenance);

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

  return getLegacyReplaySelection(provenance, playTime, currentNode);
}

export function getReplayNodeId(
  provenance: TrrackedProvenance,
  playTime: number,
  currentNode?: string | null,
) {
  return getReplaySelection(provenance, playTime, currentNode).nodeId;
}
