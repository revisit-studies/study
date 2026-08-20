import type { ResponseBlockLocation } from '../parser/types';
import type {
  ProvenanceTraversalEvent, StoredAnswer, StoredProvenance, TrrackedProvenance,
} from './types';

export const PROVENANCE_LOCATIONS: ResponseBlockLocation[] = [
  'aboveStimulus',
  'belowStimulus',
  'sidebar',
  'stimulus',
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

export function appendProvenanceTraversalEvent(
  previousProvenance: TrrackedProvenance | undefined,
  incomingProvenance: TrrackedProvenance,
  observedAt: number,
): TrrackedProvenance {
  const isSameGraph = previousProvenance?.root === incomingProvenance.root;
  const previousEvents = isSameGraph && previousProvenance
    ? getProvenanceTraversalEvents(previousProvenance)
    : [];
  const incomingEvents = getProvenanceTraversalEvents(incomingProvenance);
  const traversalEvents = incomingEvents.length >= previousEvents.length
    ? incomingEvents
    : previousEvents;
  const currentNodeId = incomingProvenance.current as string;
  const currentNode = incomingProvenance.nodes?.[currentNodeId];

  if (!currentNode || traversalEvents.at(-1)?.nodeId === currentNodeId) {
    return traversalEvents.length > 0
      ? { ...incomingProvenance, traversalEvents }
      : incomingProvenance;
  }

  const isNewNode = !isSameGraph || !previousProvenance?.nodes[currentNodeId];
  const eventTime = isNewNode ? currentNode.createdOn : observedAt;
  const previousEventTime = traversalEvents.at(-1)?.createdOn ?? Number.NEGATIVE_INFINITY;
  const createdOn = Math.max(eventTime, previousEventTime + 1);

  return {
    ...incomingProvenance,
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
