import type { StorageEngine } from '../storage/engines/types';
import { GLOBAL_STORE_TASK } from './globalStoreProvenance';
import type {
  ProvenanceLocation, ProvenanceTraversalEvent, StoredAnswer, StoredProvenance, TrrackedProvenance,
} from './types';

export const PROVENANCE_LOCATIONS: ProvenanceLocation[] = [
  'aboveStimulus',
  'belowStimulus',
  'sidebar',
  'stimulus',
  'globalStore',
];

export type LegacyStoredAnswerWithProvenance = StoredAnswer & {
  provenanceGraph?: unknown;
};

export function createEmptyProvenance(): StoredProvenance {
  return {
    aboveStimulus: undefined,
    belowStimulus: undefined,
    sidebar: undefined,
    stimulus: undefined,
  };
}

export function getProvenanceTraversalEvents(
  provenance: TrrackedProvenance,
): ProvenanceTraversalEvent[] {
  if (!Array.isArray(provenance.traversalEvents)) {
    return [];
  }

  return provenance.traversalEvents
    .filter((event): event is ProvenanceTraversalEvent => (
      typeof event === 'object'
      && event !== null
      && typeof event.nodeId === 'string'
      && event.nodeId in provenance.nodes
      && typeof event.createdOn === 'number'
      && Number.isFinite(event.createdOn)
    ))
    .sort((first, second) => first.createdOn - second.createdOn);
}

/** Retain independent visits as checkpoint branches in one replayable graph. */
export function mergeProvenanceGraphs(
  previous: TrrackedProvenance | undefined,
  incoming: TrrackedProvenance,
): TrrackedProvenance {
  if (!previous) return incoming;
  const nodes = { ...previous.nodes };
  const retainedRoot = nodes[incoming.root];
  const parent = previous.nodes[previous.current];
  const levelOffset = incoming.root === previous.root ? 0
    : (retainedRoot?.level ?? parent.level + 1) - incoming.nodes[incoming.root].level;
  Object.entries(incoming.nodes).forEach(([id, node]) => {
    const retained = nodes[id];
    const children = [...new Set([...(retained?.children ?? []), ...node.children])];
    if (id === incoming.root && incoming.root !== previous.root) {
      // A legacy page starts over on every load. Keep its root ID/checkpoint so
      // old submission references and patch checkpoint references remain valid.
      nodes[id] = {
        ...node,
        event: '__revisit_visit',
        parent: retained && 'parent' in retained ? retained.parent : previous.current,
        sideEffects: { do: [], undo: [] },
        level: node.level + levelOffset,
        children,
      };
    } else {
      nodes[id] = { ...node, level: node.level + levelOffset, children };
    }
  });
  if (incoming.root !== previous.root && !retainedRoot) {
    nodes[parent.id] = { ...nodes[parent.id], children: [...nodes[parent.id].children, incoming.root] };
  }
  const events = [...getProvenanceTraversalEvents(previous), ...getProvenanceTraversalEvents(incoming)];
  const seen = new Set<string>();
  const traversalEvents = events.filter(({ nodeId, createdOn }) => {
    const key = `${nodeId}/${createdOn}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((first, second) => first.createdOn - second.createdOn);
  return {
    ...incoming, root: previous.root, nodes, ...(traversalEvents.length ? { traversalEvents } : {}),
  };
}

/** A former visit root can now be a checkpoint branch below the canonical root. */
export function hasProvenanceSource(
  graph: TrrackedProvenance | undefined,
  source: { root: string; current: string },
): boolean {
  if (!graph?.nodes[source.root]) return false;
  const visited = new Set<string>();
  let node: TrrackedProvenance['nodes'][string] | undefined = graph.nodes[source.current];
  while (node && !visited.has(node.id)) {
    if (node.id === source.root) return true;
    visited.add(node.id);
    node = 'parent' in node ? graph.nodes[node.parent] : undefined;
  }
  return false;
}

export function mergeStoredProvenance(previous: StoredProvenance | null, incoming: StoredProvenance): StoredProvenance {
  const merged = { ...previous, ...incoming };
  (['aboveStimulus', 'belowStimulus', 'sidebar', 'stimulus'] as const).forEach((location) => {
    const graph = incoming[location];
    merged[location] = graph ? mergeProvenanceGraphs(previous?.[location], graph) : previous?.[location];
  });
  return merged;
}

export function appendProvenanceTraversalEvent(
  previousProvenance: TrrackedProvenance | undefined,
  incomingProvenance: TrrackedProvenance,
  observedAt: number,
): TrrackedProvenance {
  const merged = mergeProvenanceGraphs(previousProvenance, incomingProvenance);
  const traversalEvents = getProvenanceTraversalEvents(merged);
  const currentNodeId = incomingProvenance.current as string;
  const currentNode = incomingProvenance.nodes?.[currentNodeId];

  if (!currentNode || traversalEvents.at(-1)?.nodeId === currentNodeId) {
    return traversalEvents.length > 0
      ? { ...merged, traversalEvents }
      : merged;
  }

  const isNewNode = !previousProvenance?.nodes[currentNodeId];
  const eventTime = isNewNode ? currentNode.createdOn : observedAt;
  const previousEventTime = traversalEvents.at(-1)?.createdOn ?? Number.NEGATIVE_INFINITY;
  const createdOn = Math.max(eventTime, previousEventTime + 1);

  return {
    ...merged,
    traversalEvents: [...traversalEvents, { nodeId: currentNodeId, createdOn }],
  };
}

export function normalizeStoredProvenance(provenanceGraph: unknown): StoredProvenance | null {
  if (!provenanceGraph || typeof provenanceGraph !== 'object') {
    return null;
  }

  const provenanceCandidate = provenanceGraph as Partial<StoredProvenance>;
  const provenance = createEmptyProvenance();
  let hasProvenance = false;

  PROVENANCE_LOCATIONS.forEach((location) => {
    if (provenanceCandidate[location]) {
      provenance[location] = provenanceCandidate[location];
      hasProvenance = true;
    }
  });

  return hasProvenance ? provenance : null;
}

export function hasStoredProvenance(provenanceGraph: unknown) {
  return normalizeStoredProvenance(provenanceGraph) !== null;
}

export function getLegacyStoredAnswerProvenance(answer: unknown) {
  if (!answer || typeof answer !== 'object') {
    return null;
  }

  return normalizeStoredProvenance(
    (answer as LegacyStoredAnswerWithProvenance).provenanceGraph,
  );
}

export function stripProvenanceFromStoredAnswer(
  answer: StoredAnswer | LegacyStoredAnswerWithProvenance,
): StoredAnswer {
  const { provenanceGraph: _provenanceGraph, ...answerWithoutProvenance } = answer as LegacyStoredAnswerWithProvenance;
  return answerWithoutProvenance;
}

export function splitProvenanceFromAnswers(answers: Record<string, StoredAnswer>) {
  const provenanceByIdentifier: Record<string, StoredProvenance> = {};
  const answersWithoutProvenance: Record<string, StoredAnswer> = {};

  Object.entries(answers).forEach(([identifier, answer]) => {
    const provenanceGraph = getLegacyStoredAnswerProvenance(answer);

    if (provenanceGraph) {
      provenanceByIdentifier[identifier] = provenanceGraph;
    }

    answersWithoutProvenance[identifier] = stripProvenanceFromStoredAnswer(answer);
  });

  return {
    answers: answersWithoutProvenance,
    provenanceByIdentifier,
  };
}

export async function getCombinedProvenance(storage: Pick<StorageEngine, 'getProvenance'>, task: string, participantId: string) {
  const [trial, global] = await Promise.all([
    storage.getProvenance(task, participantId), storage.getProvenance(GLOBAL_STORE_TASK, participantId),
  ]);
  return global?.globalStore ? { ...createEmptyProvenance(), ...trial, globalStore: global.globalStore } : trial;
}
