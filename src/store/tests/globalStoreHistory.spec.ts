import { expect, test } from 'vitest';
import { makeStoredAnswer } from '../../tests/utils';
import { createGlobalStoreSubmission } from '../globalStoreProvenance';
import { getGlobalStoreHistory, projectHistoricalGlobalStore } from '../globalStoreHistory';

const definitions = { budget: { initialValue: 100 } };
const answer = (identifier: string, trialOrder: string, cost: number) => makeStoredAnswer({
  identifier, trialOrder, componentName: 'purchase', answer: { cost }, endTime: 20,
});

test('replay reconstructs either recorded path from provenance, including invalidated answers', () => {
  const a = createGlobalStoreSubmission(undefined, definitions, answer('A', '0', 30), { budget: 70 }, [], {});
  const b = createGlobalStoreSubmission(a.graph, definitions, answer('B', '1', 20), { budget: 50 }, [], {});
  const revision = createGlobalStoreSubmission(b.graph, definitions, answer('A', '0', 10), { budget: 90 }, [], {});
  const revisedB = createGlobalStoreSubmission(revision.graph, definitions, answer('B', '1', 15), { budget: 75 }, [], {});
  const currentAnswers = { A: answer('A', '0', 10), B: answer('B', '1', 15) };
  const original = projectHistoricalGlobalStore(revisedB.graph, b.nodeId, currentAnswers);
  expect(original.answers.A.answer.cost).toBe(30);
  expect(original.answers.B.answer.cost).toBe(20);
  expect(original.graph.current).toBe(b.nodeId);
  const revised = projectHistoricalGlobalStore(revisedB.graph, revisedB.nodeId, currentAnswers);
  expect(revised.answers.A.answer.cost).toBe(10);
  expect(revised.answers.B.answer.cost).toBe(15);
  expect(revisedB.graph.current).toBe(revisedB.nodeId);
  const history = getGlobalStoreHistory(revisedB.graph);
  expect(history).toHaveLength(4);
  expect(history.filter((entry) => entry.active).map((entry) => entry.after.budget)).toEqual([90, 75]);
  expect(history.find((entry) => entry.nodeId === b.nodeId)).toMatchObject({ active: false, before: { budget: 70 }, after: { budget: 50 } });
});
