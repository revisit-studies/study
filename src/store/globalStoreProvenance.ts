import { initializeTrrack, Registry } from '@trrack/core';
import type { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import isEqual from 'lodash.isequal';
import type { GlobalStoreValues, GlobalVariableDeclarations } from '../parser/types';
import { getInitialGlobalVariables } from '../utils/globalStore';
import type { AppliedGlobalStoreAction } from '../utils/globalStore';
import type { ProvenanceTraversalEvent, StoredAnswer, StoredProvenance } from './types';
import { parseTrialOrder } from '../utils/parseTrialOrder';

export const GLOBAL_STORE_TASK = '__globalStore';

export type GlobalStoreSubmission = {
  answer: StoredAnswer;
  sourceNodes: Record<string, { root: string; current: string }>;
  operations: AppliedGlobalStoreAction[];
  replaces: string | null;
  invalidated: string[];
  /** The trial entry can precede the current global head when revisiting. */
  entryNodeId?: string;
  /** An unchanged revisit keeps later global progress, but has its own trial result. */
  resultValues?: GlobalStoreValues;
};
export type GlobalStoreProvenanceState = {
  values: GlobalStoreValues;
  submission: GlobalStoreSubmission | null;
};
export type GlobalStoreGraph = ProvenanceGraph<GlobalStoreProvenanceState, string> & {
  traversalEvents?: ProvenanceTraversalEvent[];
};

function loadGlobalStore(graph?: GlobalStoreGraph, definitions: GlobalVariableDeclarations = {}) {
  const registry = Registry.create();
  const submit = registry.register('global-store-submit', (_state: GlobalStoreProvenanceState, next: GlobalStoreProvenanceState) => next);
  const trrack = initializeTrrack({ registry, initialState: { values: getInitialGlobalVariables(definitions), submission: null } as GlobalStoreProvenanceState });
  if (graph) trrack.importObject(structuredClone(graph));
  return { trrack, submit };
}

export function getGlobalStoreNodeState(graph: GlobalStoreGraph, nodeId: string = graph.current): GlobalStoreProvenanceState {
  const node = graph.nodes[nodeId];
  if (!node) throw new Error('The saved global store history is missing a referenced state.');
  return loadGlobalStore(graph).trrack.getState(node);
}

export function getGlobalStoreNodeStates(graph: GlobalStoreGraph) {
  const { trrack } = loadGlobalStore(graph);
  return Object.fromEntries(Object.values(graph.nodes).map((node) => [node.id, trrack.getState(node)]));
}

export function getActiveGlobalStoreSubmissions(graph?: GlobalStoreGraph) {
  if (!graph) return [];
  const { trrack } = loadGlobalStore(graph);
  const submissions: { nodeId: string; submission: GlobalStoreSubmission; values: GlobalStoreValues; parent: string }[] = [];
  const visited = new Set<string>();
  let node = graph.nodes[graph.current];
  while (node && 'parent' in node) {
    if (visited.has(node.id)) throw new Error('The saved global store history contains a cycle.');
    visited.add(node.id);
    const state = trrack.getState(node);
    if (state.submission) {
      submissions.push({
        nodeId: node.id,
        submission: state.submission,
        values: state.submission.resultValues ?? state.values,
        parent: state.submission.entryNodeId ?? node.parent,
      });
    }
    node = graph.nodes[node.parent];
  }
  if (!node || node.id !== graph.root) throw new Error('The saved global store history is incomplete.');
  const active = new Map<string, typeof submissions[number]>();
  submissions.reverse().forEach((entry) => {
    entry.submission.invalidated.forEach((identifier) => active.delete(identifier));
    active.set(entry.submission.answer.identifier, entry);
  });
  return [...active.values()];
}

export function getGlobalStoreEntryValues(graph: GlobalStoreGraph | undefined, definitions: GlobalVariableDeclarations, identifier: string): GlobalStoreValues {
  if (!graph) return getInitialGlobalVariables(definitions);
  const accepted = getActiveGlobalStoreSubmissions(graph).find((entry) => entry.submission.answer.identifier === identifier);
  return getGlobalStoreNodeState(graph, accepted?.parent ?? graph.current).values;
}

/** Dynamic generation sees the accepted prefix, including an earlier unchanged visit's result. */
export function getGlobalStoreContextBeforeTrial(graph: GlobalStoreGraph | undefined, definitions: GlobalVariableDeclarations, step: number, funcIndex: number) {
  const prefix = getActiveGlobalStoreSubmissions(graph).filter(({ submission }) => {
    const order = parseTrialOrder(submission.answer.trialOrder);
    return order.step !== null && (order.step < step || (order.step === step && (order.funcIndex ?? -1) < funcIndex));
  });
  return {
    store: prefix.at(-1)?.values ?? getInitialGlobalVariables(definitions),
    answers: Object.fromEntries(prefix.map(({ submission }) => [submission.answer.identifier, submission.answer])),
  };
}

/** Retain every accepted visit; replacements determine which answers remain active. */
export function createGlobalStoreSubmission(
  graph: GlobalStoreGraph | undefined,
  definitions: GlobalVariableDeclarations,
  answer: StoredAnswer,
  values: GlobalStoreValues,
  operations: AppliedGlobalStoreAction[],
  sourceProvenance: Partial<StoredProvenance>,
) {
  const active = getActiveGlobalStoreSubmissions(graph);
  const index = active.findIndex((entry) => entry.submission.answer.identifier === answer.identifier);
  const previous = index >= 0 ? active[index] : undefined;
  const unchanged = !!previous && isEqual(previous.submission.answer.answer, answer.answer) && isEqual(previous.values, values);
  const invalidated = previous && !unchanged ? active.slice(index + 1).map((entry) => entry.submission.answer.identifier) : [];
  const { trrack, submit } = loadGlobalStore(graph, definitions);
  const sourceNodes = Object.fromEntries(Object.entries(sourceProvenance).flatMap(([location, provenance]) => (
    provenance ? [[location, { root: provenance.root, current: provenance.current }]] : []
  )));
  const entryNodeId = previous?.parent ?? trrack.graph.current.id;
  trrack.apply(unchanged ? 'Resubmit trial' : previous ? 'Revise earlier submission' : 'Submit trial', submit({
    values: structuredClone(unchanged ? trrack.getState().values : values),
    submission: {
      answer: structuredClone(answer),
      sourceNodes,
      operations: structuredClone(operations),
      replaces: previous?.nodeId ?? null,
      invalidated,
      entryNodeId,
      ...(unchanged ? { resultValues: structuredClone(values) } : {}),
    },
  }));
  const result = trrack.exportObject() as GlobalStoreGraph;
  const nodeId = result.current;
  const events = graph?.traversalEvents ?? [];
  result.traversalEvents = [...events, { nodeId, createdOn: Math.max(Date.now(), (events.at(-1)?.createdOn ?? 0) + 1) }];
  return {
    graph: result, nodeId, unchanged, invalidated,
  };
}
