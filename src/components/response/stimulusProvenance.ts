import { initializeTrrack, Registry } from '@trrack/core';
import type { TrrackedProvenance } from '../../store/types';

type StimulusReplayState = {
  showStimulusErrors?: boolean;
  [key: string]: unknown;
};

export function getStimulusShowErrorsFromState(state: unknown) {
  return typeof state === 'object'
    && state !== null
    && 'showStimulusErrors' in state
    && (state as { showStimulusErrors?: unknown }).showStimulusErrors === true;
}

export function getStimulusProvenanceState(state: unknown) {
  if (typeof state !== 'object' || state === null || !('showStimulusErrors' in state)) {
    return state;
  }

  const { showStimulusErrors: _showStimulusErrors, ...provenanceState } = state as StimulusReplayState;
  return Object.keys(provenanceState).length > 0 ? provenanceState : undefined;
}

export function appendStimulusShowErrorsToGraph(
  provenanceGraph?: TrrackedProvenance,
  showStimulusErrors: boolean = true,
) {
  const reg = Registry.create();
  const setShowStimulusErrorsAction = reg.register('show-stimulus-errors', ((state: StimulusReplayState, payload: boolean) => {
    state.showStimulusErrors = payload;
    return state;
  }) as never) as unknown as (payload: boolean) => unknown;

  const trrack = initializeTrrack({
    registry: reg,
    initialState: {
      showStimulusErrors: false,
    } as StimulusReplayState,
  });

  if (provenanceGraph) {
    trrack.importObject(structuredClone(provenanceGraph));
  }

  trrack.apply('Show stimulus errors', setShowStimulusErrorsAction(showStimulusErrors) as never);
  return trrack.graph.backend;
}
