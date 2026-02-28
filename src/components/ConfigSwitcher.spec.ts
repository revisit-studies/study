import {
  describe, expect, test,
} from 'vitest';
import { resolveHomeTab } from './ConfigSwitcher';

describe('resolveHomeTab', () => {
  test('falls back to first tab when requested tab is null', () => {
    expect(resolveHomeTab(null, ['Others', 'Demos'], 'Others')).toBe('Others');
  });

  test('falls back to first tab when requested tab is unavailable', () => {
    expect(resolveHomeTab('Demos', ['Others'], 'Others')).toBe('Others');
  });

  test('uses requested tab when it is available', () => {
    expect(resolveHomeTab('Others', ['Others', 'Demos'], 'Others')).toBe('Others');
  });
});
