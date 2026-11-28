import type { ParticipantLoadTiming, ParticipantMetadata } from '../store/types';

/** How many recent loads to keep per participant. */
export const LOAD_TIMINGS_LIMIT = 20;

/**
 * Records that a study load phase finished. Returns the time, in whole
 * milliseconds since the page began loading, and also leaves a
 * `revisit:<phase>` performance mark so browser tools and tests can read it.
 */
export function markLoadPhase(phase: string) {
  try {
    performance.mark(`revisit:${phase}`);
  } catch {
    // Marks are a convenience; the returned time is what gets stored.
  }
  return Math.round(performance.now());
}

/** When the HTML was parsed and the app's scripts had run, if the browser reports it. */
export function getDocumentLoadedMs() {
  try {
    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return navigation && navigation.domContentLoadedEventEnd > 0 ? Math.round(navigation.domContentLoadedEventEnd) : undefined;
  } catch {
    return undefined;
  }
}

/** The browser's connection estimate, where supported (not in Safari or Firefox). */
export function getConnectionType() {
  const { connection } = navigator as Navigator & { connection?: { effectiveType?: string } };
  return connection?.effectiveType || undefined;
}

/** Adds a load to the metadata, keeping only the most recent loads. */
export function appendLoadTiming(metadata: ParticipantMetadata, timing: ParticipantLoadTiming): ParticipantMetadata {
  return {
    ...metadata,
    loadTimings: [...(metadata.loadTimings ?? []), timing].slice(-LOAD_TIMINGS_LIMIT),
  };
}
