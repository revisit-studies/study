import { initializeTrrack, Registry } from '@trrack/core';
import type { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import isEqual from 'lodash.isequal';
import type { GlobalStoreValues, GlobalVariableDeclarations } from '../parser/types';
import { getInitialGlobalVariables } from '../utils/globalStore';
import type { AppliedGlobalStoreAction } from '../utils/globalStore';
import type { ProvenanceTraversalEvent, StoredAnswer, StoredProvenance } from './types';

export const GLOBAL_STORE_TASK = '__globalStore';

export type GlobalStoreSubmission = {
  answer: StoredAnswer;
  sourceNodes: Record<string, { root: string; current: string }>;
  operations: AppliedGlobalStoreAction[];
  replaces: string | null;
  invalidated: string[];
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
        nodeId: node.id, submission: state.submission, values: state.values, parent: node.parent,
      });
    }
    node = graph.nodes[node.parent];
  }
  if (!node || node.id !== graph.root) throw new Error('The saved global store history is incomplete.');
  return submissions.reverse();
}

export function getGlobalStoreEntryValues(graph: GlobalStoreGraph | undefined, definitions: GlobalVariableDeclarations, identifier: string): GlobalStoreValues {
  if (!graph) return getInitialGlobalVariables(definitions);
  const accepted = getActiveGlobalStoreSubmissions(graph).find((entry) => entry.submission.answer.identifier === identifier);
  return getGlobalStoreNodeState(graph, accepted?.parent ?? graph.current).values;
}

/** Fork a retained graph for an earlier edit; original nodes remain the only history source. */
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
  const snapshot = graph ? structuredClone(graph) : undefined;
  if (snapshot && previous && !unchanged) snapshot.current = previous.parent as typeof snapshot.current;
  const { trrack, submit } = loadGlobalStore(snapshot, definitions);
  if (!unchanged) {
    const sourceNodes = Object.fromEntries(Object.entries(sourceProvenance).flatMap(([location, provenance]) => (
      provenance ? [[location, { root: provenance.root, current: provenance.current }]] : []
    )));
    trrack.apply(previous ? 'Revise earlier submission' : 'Submit trial', submit({
      values: structuredClone(values),
      submission: {
        answer: structuredClone(answer),
        sourceNodes,
        operations: structuredClone(operations),
        replaces: previous?.nodeId ?? null,
        invalidated,
      },
    }));
  }
  const result = trrack.exportObject() as GlobalStoreGraph;
  const nodeId = unchanged ? previous!.nodeId : result.current;
  const events = graph?.traversalEvents ?? [];
  // A successful unchanged submit is still a real boundary, without moving the active head.
  result.traversalEvents = [...events, { nodeId, createdOn: Math.max(Date.now(), (events.at(-1)?.createdOn ?? 0) + 1) }];
  return {
    graph: result, nodeId, unchanged, invalidated,
  };
}
