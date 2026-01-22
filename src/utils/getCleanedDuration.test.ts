import { describe, it, expect } from 'vitest';
import { getCleanedDuration } from './getCleanedDuration';
import { EventType } from '../store/types';

describe('getCleanedDuration', () => {
  // ============================================
  // Basic duration calculation
  // ============================================

  describe('basic duration calculation', () => {
    it('calculates basic duration with no window events', () => {
      const answer = {
        startTime: 1000,
        endTime: 5000,
        windowEvents: [],
      };
      expect(getCleanedDuration(answer)).toBe(4000);
    });

    it('returns -1 when endTime is -1', () => {
      const answer = {
        startTime: 1000,
        endTime: -1,
        windowEvents: [],
      };
      expect(getCleanedDuration(answer)).toBe(-1);
    });

    it('handles zero duration (returns -1 due to falsy 0)', () => {
      const answer = {
        startTime: 1000,
        endTime: 1000,
        windowEvents: [],
      };
      // Zero duration is falsy, so the function returns -1
      expect(getCleanedDuration(answer)).toBe(-1);
    });

    it('calculates duration for large time values', () => {
      const answer = {
        startTime: 1000000,
        endTime: 2000000,
        windowEvents: [],
      };
      expect(getCleanedDuration(answer)).toBe(1000000);
    });
  });

  // ============================================
  // Single visibility event pair
  // ============================================

  describe('single visibility event pair', () => {
    it('subtracts time when window was hidden once', () => {
      const answer = {
        startTime: 1000,
        endTime: 10000,
        windowEvents: [
          [2000, 'visibility', 'hidden'],
          [5000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 9000ms, hidden: 3000ms (5000-2000), cleaned: 6000ms
      expect(getCleanedDuration(answer)).toBe(6000);
    });

    it('handles hidden period at the start', () => {
      const answer = {
        startTime: 1000,
        endTime: 10000,
        windowEvents: [
          [1000, 'visibility', 'hidden'],
          [3000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 9000ms, hidden: 2000ms (3000-1000), cleaned: 7000ms
      expect(getCleanedDuration(answer)).toBe(7000);
    });

    it('handles hidden period near the end', () => {
      const answer = {
        startTime: 1000,
        endTime: 10000,
        windowEvents: [
          [8000, 'visibility', 'hidden'],
          [9500, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 9000ms, hidden: 1500ms (9500-8000), cleaned: 7500ms
      expect(getCleanedDuration(answer)).toBe(7500);
    });
  });

  // ============================================
  // Multiple visibility event pairs
  // ============================================

  describe('multiple visibility event pairs', () => {
    it('subtracts multiple hidden periods', () => {
      const answer = {
        startTime: 1000,
        endTime: 20000,
        windowEvents: [
          [2000, 'visibility', 'hidden'],
          [5000, 'visibility', 'visible'],
          [10000, 'visibility', 'hidden'],
          [15000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 19000ms
      // Hidden1: 3000ms (5000-2000)
      // Hidden2: 5000ms (15000-10000)
      // Total hidden: 8000ms
      // Cleaned: 11000ms
      expect(getCleanedDuration(answer)).toBe(11000);
    });

    it('handles three separate hidden periods', () => {
      const answer = {
        startTime: 0,
        endTime: 30000,
        windowEvents: [
          [5000, 'visibility', 'hidden'],
          [8000, 'visibility', 'visible'],
          [12000, 'visibility', 'hidden'],
          [15000, 'visibility', 'visible'],
          [20000, 'visibility', 'hidden'],
          [25000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 30000ms
      // Hidden: (8000-5000) + (15000-12000) + (25000-20000) = 3000 + 3000 + 5000 = 11000ms
      // Cleaned: 19000ms
      expect(getCleanedDuration(answer)).toBe(19000);
    });

    it('handles consecutive hidden-visible pairs', () => {
      const answer = {
        startTime: 0,
        endTime: 10000,
        windowEvents: [
          [1000, 'visibility', 'hidden'],
          [2000, 'visibility', 'visible'],
          [2001, 'visibility', 'hidden'],
          [3000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 10000ms
      // Hidden: (2000-1000) + (3000-2001) = 1000 + 999 = 1999ms
      // Cleaned: 8001ms
      expect(getCleanedDuration(answer)).toBe(8001);
    });
  });

  // ============================================
  // Orphaned and unpaired events
  // ============================================

  describe('orphaned and unpaired events', () => {
    it('ignores orphaned hidden event (no matching visible)', () => {
      const answer = {
        startTime: 1000,
        endTime: 10000,
        windowEvents: [
          [2000, 'visibility', 'hidden'],
        ] as EventType[],
      };
      // Hidden event with no following visible event is ignored
      expect(getCleanedDuration(answer)).toBe(9000);
    });

    it('ignores orphaned visible event (no preceding hidden)', () => {
      const answer = {
        startTime: 1000,
        endTime: 10000,
        windowEvents: [
          [5000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Visible event with no preceding hidden event is ignored
      expect(getCleanedDuration(answer)).toBe(9000);
    });

    it('handles mixed paired and orphaned events', () => {
      const answer = {
        startTime: 0,
        endTime: 20000,
        windowEvents: [
          [2000, 'visibility', 'hidden'],
          [5000, 'visibility', 'visible'],
          [10000, 'visibility', 'hidden'],
          // No visible event to close the second hidden period
        ] as EventType[],
      };
      // Only the first hidden-visible pair counts: 5000-2000 = 3000ms
      // Duration: 20000ms, hidden: 3000ms, cleaned: 17000ms
      expect(getCleanedDuration(answer)).toBe(17000);
    });

    it('ignores consecutive hidden events (only first matters)', () => {
      const answer = {
        startTime: 0,
        endTime: 10000,
        windowEvents: [
          [2000, 'visibility', 'hidden'],
          [3000, 'visibility', 'hidden'],
          [4000, 'visibility', 'hidden'],
          [7000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Algorithm pairs first hidden with first visible after it
      // Hidden: 7000-2000 = 5000ms
      // Cleaned: 5000ms
      expect(getCleanedDuration(answer)).toBe(5000);
    });

    it('handles consecutive visible events', () => {
      const answer = {
        startTime: 0,
        endTime: 10000,
        windowEvents: [
          [2000, 'visibility', 'hidden'],
          [5000, 'visibility', 'visible'],
          [6000, 'visibility', 'visible'],
          [7000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // First hidden pairs with first visible: 5000-2000 = 3000ms
      // Remaining visible events are orphaned and ignored
      expect(getCleanedDuration(answer)).toBe(7000);
    });
  });

  // ============================================
  // Edge cases
  // ============================================

  describe('edge cases', () => {
    it('filters out undefined events', () => {
      const answer = {
        startTime: 1000,
        endTime: 10000,
        windowEvents: [
          [2000, 'visibility', 'hidden'],
          [5000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // The function filters out undefined events internally
      expect(getCleanedDuration(answer)).toBe(6000);
    });

    it('ignores non-visibility events', () => {
      const answer = {
        startTime: 1000,
        endTime: 10000,
        windowEvents: [
          [1500, 'keydown', 'a'],
          [2000, 'visibility', 'hidden'],
          [3000, 'scroll', [0, 100]],
          [5000, 'visibility', 'visible'],
          [6000, 'resize', [1920, 1080]],
        ] as EventType[],
      };
      // Only visibility events matter
      expect(getCleanedDuration(answer)).toBe(6000);
    });

    it('returns -1 when cleaned duration would be negative', () => {
      const answer = {
        startTime: 1000,
        endTime: 5000,
        windowEvents: [
          [1000, 'visibility', 'hidden'],
          [10000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 4000ms, hidden: 9000ms (10000-1000)
      // Cleaned would be negative, so return -1
      expect(getCleanedDuration(answer)).toBe(-1);
    });

    it('handles zero cleaned duration (returns -1 due to falsy 0)', () => {
      const answer = {
        startTime: 1000,
        endTime: 5000,
        windowEvents: [
          [1000, 'visibility', 'hidden'],
          [5000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 4000ms, hidden: 4000ms, cleaned: 0ms
      // But 0 is falsy, so the function returns -1
      expect(getCleanedDuration(answer)).toBe(-1);
    });

    it('handles empty windowEvents array', () => {
      const answer = {
        startTime: 1000,
        endTime: 5000,
        windowEvents: [],
      };
      expect(getCleanedDuration(answer)).toBe(4000);
    });

    it('handles windowEvents with only non-visibility events', () => {
      const answer = {
        startTime: 1000,
        endTime: 5000,
        windowEvents: [
          [1500, 'keydown', 'a'],
          [2000, 'scroll', [0, 100]],
          [3000, 'resize', [1920, 1080]],
        ] as EventType[],
      };
      expect(getCleanedDuration(answer)).toBe(4000);
    });

    it('handles very short hidden periods', () => {
      const answer = {
        startTime: 0,
        endTime: 10000,
        windowEvents: [
          [5000, 'visibility', 'hidden'],
          [5001, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 10000ms, hidden: 1ms, cleaned: 9999ms
      expect(getCleanedDuration(answer)).toBe(9999);
    });

    it('handles hidden period spanning entire duration (returns -1 due to falsy 0)', () => {
      const answer = {
        startTime: 1000,
        endTime: 10000,
        windowEvents: [
          [1000, 'visibility', 'hidden'],
          [10000, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 9000ms, hidden: 9000ms, cleaned: 0ms
      // But 0 is falsy, so the function returns -1
      expect(getCleanedDuration(answer)).toBe(-1);
    });

    it('handles multiple short hidden periods', () => {
      const answer = {
        startTime: 0,
        endTime: 1000,
        windowEvents: [
          [100, 'visibility', 'hidden'],
          [150, 'visibility', 'visible'],
          [200, 'visibility', 'hidden'],
          [250, 'visibility', 'visible'],
          [300, 'visibility', 'hidden'],
          [350, 'visibility', 'visible'],
        ] as EventType[],
      };
      // Duration: 1000ms
      // Hidden: (150-100) + (250-200) + (350-300) = 50 + 50 + 50 = 150ms
      // Cleaned: 850ms
      expect(getCleanedDuration(answer)).toBe(850);
    });
  });

  // ============================================
  // Real-world scenarios
  // ============================================

  describe('real-world scenarios', () => {
    it('handles typical user tab switching', () => {
      const answer = {
        startTime: 0,
        endTime: 60000, // 1 minute task
        windowEvents: [
          [15000, 'visibility', 'hidden'], // User switches away at 15s
          [20000, 'visibility', 'visible'], // Returns after 5s
          [45000, 'visibility', 'hidden'], // Switches away again at 45s
          [50000, 'visibility', 'visible'], // Returns after 5s
        ] as EventType[],
      };
      // Duration: 60000ms (1 minute)
      // Hidden: 5000ms + 5000ms = 10000ms
      // Cleaned: 50000ms (50 seconds of actual work)
      expect(getCleanedDuration(answer)).toBe(50000);
    });

    it('handles user who never returns (orphaned hidden)', () => {
      const answer = {
        startTime: 0,
        endTime: 30000,
        windowEvents: [
          [10000, 'visibility', 'hidden'], // User switches away
          // Never returns
        ] as EventType[],
      };
      // The orphaned hidden event is ignored
      expect(getCleanedDuration(answer)).toBe(30000);
    });

    it('handles user starting with tab in background (orphaned visible)', () => {
      const answer = {
        startTime: 0,
        endTime: 30000,
        windowEvents: [
          [5000, 'visibility', 'visible'], // Comes to foreground
          [10000, 'visibility', 'hidden'], // Goes to background
          [15000, 'visibility', 'visible'], // Comes back
        ] as EventType[],
      };
      // Only the hidden-visible pair counts: 15000-10000 = 5000ms
      expect(getCleanedDuration(answer)).toBe(25000);
    });

    it('handles no interaction (no visibility events)', () => {
      const answer = {
        startTime: 0,
        endTime: 30000,
        windowEvents: [
          [5000, 'click', 'button1'],
          [10000, 'click', 'button2'],
          [15000, 'input', 'text'],
        ] as EventType[],
      };
      // No visibility events means user stayed on page
      expect(getCleanedDuration(answer)).toBe(30000);
    });
  });
});
