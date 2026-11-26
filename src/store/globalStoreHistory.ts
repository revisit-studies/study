import type { ParticipantData } from '../parser/types';
import type { GlobalStoreGraph } from './globalStoreProvenance';
import { getActiveGlobalStoreSubmissions, getGlobalStoreNodeState, getGlobalStoreNodeStates } from './globalStoreProvenance';
import { parseTrialOrder } from '../utils/parseTrialOrder';

/** Read recorded outcomes only: replay and exports never execute study code. */
export function getGlobalStoreHistory(graph: GlobalStoreGraph) {
  const states = getGlobalStoreNodeStates(graph);
  const active = new Set(getActiveGlobalStoreSubmissions(graph).map((entry) => entry.nodeId));
  return Object.values(graph.nodes).flatMap((node) => {
    const state = states[node.id];
    if (!state.submission || !('parent' in node)) return [];
    return [{
      nodeId: node.id,
      createdOn: node.createdOn,
      active: active.has(node.id),
      before: states[state.submission.entryNodeId ?? node.parent].values,
      after: state.submission.resultValues ?? state.values,
      submission: state.submission,
    }];
  }).sort((first, second) => first.createdOn - second.createdOn);
}

export function projectHistoricalGlobalStore(graph: GlobalStoreGraph, nodeId: string, currentAnswers: ParticipantData['answers']) {
  if (!getGlobalStoreNodeState(graph, nodeId).submission) throw new Error('Select a recorded submission to replay.');
  const historicalGraph = { ...graph, current: nodeId as typeof graph.current };
  const answers: ParticipantData['answers'] = {};
  Object.entries(currentAnswers).forEach(([identifier, answer]) => {
    if (parseTrialOrder(answer.trialOrder).funcIndex !== null) return;
    const placeholder = { ...answer };
    delete placeholder.assetIdentifier;
    delete placeholder.recordingSegments;
    delete placeholder.recordingSegmentRanges;
    delete placeholder.recordingSegmentTimes;
    delete placeholder.recordingChunkKeys;
    delete placeholder.recordingEndTime;
    delete placeholder.recordingStartTime;
    answers[identifier] = {
      ...placeholder, globalStoreEntry: undefined, answer: {}, startTime: 0, endTime: -1, windowEvents: [], checkAnswer: undefined,
    };
  });
  getActiveGlobalStoreSubmissions(historicalGraph).forEach(({ submission }) => {
    const historicalAnswer = structuredClone(submission.answer);
    const currentAnswer = currentAnswers[submission.answer.identifier];
    const retainedSegments = new Set([
      ...(historicalAnswer.recordingSegments ?? []),
      ...(historicalAnswer.assetIdentifier ? [historicalAnswer.assetIdentifier] : []),
    ]);
    const recordingChunkKeys = { ...(historicalAnswer.recordingChunkKeys ?? {}) };
    retainedSegments.forEach((segment) => {
      const lateChunkKeys = currentAnswer?.recordingChunkKeys?.[segment] ?? [];
      if (lateChunkKeys.length > 0) {
        recordingChunkKeys[segment] = Array.from(new Set([...(recordingChunkKeys[segment] ?? []), ...lateChunkKeys]));
      }
    });
    if (Object.keys(recordingChunkKeys).length > 0) historicalAnswer.recordingChunkKeys = recordingChunkKeys;
    answers[submission.answer.identifier] = historicalAnswer;
  });
  return { graph: historicalGraph, answers };
}
