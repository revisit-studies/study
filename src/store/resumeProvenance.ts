import { initializeTrrack, Registry } from '@trrack/core';
import type { ConfigureTrrackOptions, Trrack } from '@trrack/core';
import type { TrrackedProvenance } from './types';

/** Import before subscribing, so restoration never becomes a participant event. */
export function initializeResumedTrrack<State, Event extends string>(
  options: ConfigureTrrackOptions<State, Event>,
  provenance?: TrrackedProvenance,
): Trrack<State, Event> {
  const trrack = initializeTrrack(options);
  if (provenance) {
    if (!provenance.nodes?.[provenance.root] || !provenance.nodes?.[provenance.current]) {
      throw new Error('Saved interaction history is invalid.');
    }
    trrack.graph.update(trrack.graph.load(structuredClone(provenance)));
    trrack.getState();
  }
  return trrack;
}

export function getResumedProvenanceState(provenance: TrrackedProvenance) {
  return initializeResumedTrrack({ registry: Registry.create(), initialState: {} }, provenance).getState();
}
