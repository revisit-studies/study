import {
  describe,
  expect,
  test,
} from 'vitest';
import { encryptIndex } from '../../../utils/encryptDecryptIndex';
import { buildTaskNavigationTarget } from './taskNavigation';

describe('buildTaskNavigationTarget', () => {
  test('updates currentTrial when navigating between replay tasks', () => {
    const target = buildTaskNavigationTarget({
      answerIdentifier: 'jupyterlite-task-2_8',
      trialOrder: '8',
      isReplay: true,
      studyId: 'buckaroo',
      search: '?participantId=66aa582aba2b183e61577d44&currentTrial=jupyterlite-task-1_7',
    });

    expect(target).toEqual({
      pathname: `/buckaroo/${encryptIndex(8)}`,
      search: '?participantId=66aa582aba2b183e61577d44&currentTrial=jupyterlite-task-2_8',
    });
  });

  test('keeps analysis tagging navigation search unchanged', () => {
    const target = buildTaskNavigationTarget({
      answerIdentifier: 'task_4',
      trialOrder: '4',
      isReplay: false,
      studyId: 'study-1',
      search: '?participantId=p-1&currentTrial=task_3',
    });

    expect(target).toEqual({
      pathname: '/analysis/stats/study-1/tagging/task_4',
      search: '?participantId=p-1&currentTrial=task_3',
    });
  });
});
