import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import type { ParticipantLoadTiming, ParticipantMetadata } from '../../store/types';
import {
  appendLoadTiming, getConnectionType, getDocumentLoadedMs, LOAD_TIMINGS_LIMIT, markLoadPhase,
} from '../loadTiming';

const metadata: ParticipantMetadata = {
  userAgent: 'agent', resolution: {}, language: 'en', ip: null,
};

function timing(readyMs: number): ParticipantLoadTiming {
  return {
    recordedAt: 1,
    newParticipant: false,
    attempt: 0,
    storageReadyMs: 1,
    studyDatabaseReadyMs: 2,
    configSavedMs: 3,
    sequenceArrayLoadedMs: 4,
    participantJoinedMs: 5,
    readyMs,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  performance.clearMarks();
});

describe('markLoadPhase', () => {
  test('returns whole milliseconds since the page began loading and leaves a mark', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1234.6);
    expect(markLoadPhase('ready')).toBe(1235);
    expect(performance.getEntriesByName('revisit:ready', 'mark')).toHaveLength(1);
  });

  test('still returns the time when marks are unavailable', () => {
    vi.spyOn(performance, 'mark').mockImplementation(() => { throw new Error('unsupported'); });
    vi.spyOn(performance, 'now').mockReturnValue(10);
    expect(markLoadPhase('ready')).toBe(10);
  });
});

describe('appendLoadTiming', () => {
  test('adds the load and keeps the other metadata', () => {
    const updated = appendLoadTiming({ ...metadata, colorMode: 'dark' }, timing(100));
    expect(updated).toEqual({ ...metadata, colorMode: 'dark', loadTimings: [timing(100)] });
  });

  test('keeps only the most recent loads', () => {
    let updated = metadata;
    for (let index = 0; index < LOAD_TIMINGS_LIMIT + 5; index += 1) updated = appendLoadTiming(updated, timing(index));
    expect(updated.loadTimings).toHaveLength(LOAD_TIMINGS_LIMIT);
    expect(updated.loadTimings![0].readyMs).toBe(5);
    expect(updated.loadTimings!.at(-1)!.readyMs).toBe(LOAD_TIMINGS_LIMIT + 4);
  });
});

describe('browser details', () => {
  test('reads when the document finished loading', () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ domContentLoadedEventEnd: 812.4 } as PerformanceNavigationTiming]);
    expect(getDocumentLoadedMs()).toBe(812);
  });

  test('omits the document time when the browser has none', () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
    expect(getDocumentLoadedMs()).toBeUndefined();
  });

  test('reports the connection type only where the browser does', () => {
    vi.stubGlobal('navigator', { connection: { effectiveType: '4g' } });
    expect(getConnectionType()).toBe('4g');
    vi.stubGlobal('navigator', {});
    expect(getConnectionType()).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
