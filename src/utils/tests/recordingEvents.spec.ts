import { describe, expect, test } from 'vitest';
import { getDisplayStatus } from '../recordingEvents';

describe('getDisplayStatus', () => {
  test('reports multiple displays only when the browser confirms an extended display', () => {
    expect(getDisplayStatus({ isExtended: true })).toBe('multiple');
    expect(getDisplayStatus({ isExtended: false })).toBe('unknown');
    expect(getDisplayStatus(undefined)).toBe('unknown');
  });
});
