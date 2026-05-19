interface TrackedNode {
  id: string;
  createdOn: number;
  children: string[];
  parent?: string;
}

function isRootNode(node: TrackedNode): boolean {
  return node.parent === undefined;
}

/**
 * Traverses a provenance graph to find the node whose time range contains playTime.
 * Starting from `startNodeId`, it walks up to parents (if playTime < node's createdOn)
 * or down to children (if playTime > child's createdOn) until it finds the matching node.
 */
export function findNodeAtTime(
  startNodeId: string,
  playTime: number,
  nodes: Record<string, TrackedNode>,
): string {
  let tempNode = nodes[startNodeId];
  let done = false;

  while (!done) {
    if (playTime < tempNode.createdOn) {
      if (!isRootNode(tempNode)) {
        tempNode = nodes[tempNode.parent!];
      } else {
        done = true;
      }
    } else if (tempNode.children.length > 0) {
      const child = tempNode.children[0];

      if (playTime > nodes[child].createdOn) {
        tempNode = nodes[child];
      } else {
        done = true;
      }
    } else {
      done = true;
    }
  }

  return tempNode.id;
}
