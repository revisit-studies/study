import type { ResponseBlockLocation } from '../parser/types';
import type { StoredAnswer, StoredProvenance } from './types';

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
