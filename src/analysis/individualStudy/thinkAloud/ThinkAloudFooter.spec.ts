import {
  describe,
  expect,
  test,
} from 'vitest';
import { encryptIndex } from '../../../utils/encryptDecryptIndex';
import { buildTaskNavigationTarget } from './taskNavigation';

describe('buildTaskNavigationTarget', () => {
  test('preserves search params when navigating between replay tasks', () => {
    const target = buildTaskNavigationTarget({
      answerIdentifier: 'jupyterlite-task-2_8',
      trialOrder: '8',
      isReplay: true,
      studyId: 'buckaroo',
      search: '?participantId=66aa582aba2b183e61577d44',
    });

    expect(target).toEqual({
      pathname: `/buckaroo/${encryptIndex(8)}`,
      search: '?participantId=66aa582aba2b183e61577d44',
    });
  });

  test('preserves search params when navigating to analysis tagging', () => {
    const target = buildTaskNavigationTarget({
      answerIdentifier: 'task_4',
      trialOrder: '4',
      isReplay: false,
      studyId: 'study-1',
      search: '?participantId=p-1',
    });

    expect(target).toEqual({
      pathname: '/analysis/stats/study-1/tagging/task_4',
      search: '?participantId=p-1',
    });
  });
});
