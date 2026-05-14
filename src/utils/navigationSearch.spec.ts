import {
  describe,
  expect,
  test,
} from 'vitest';
import { removeCurrentTrialFromSearch } from './navigationSearch';

describe('removeCurrentTrialFromSearch', () => {
  test('removes currentTrial and keeps other params', () => {
    expect(removeCurrentTrialFromSearch('?participantId=p-1&currentTrial=task_3&revisitPageId=abc'))
      .toBe('?participantId=p-1&revisitPageId=abc');
  });

  test('returns an empty string when currentTrial is the only param', () => {
    expect(removeCurrentTrialFromSearch('?currentTrial=task_3')).toBe('');
  });

  test('leaves the search unchanged when currentTrial is absent', () => {
    expect(removeCurrentTrialFromSearch('?participantId=p-1')).toBe('?participantId=p-1');
  });
});
