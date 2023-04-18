import { Registry, initializeTrrack } from '@trrack/core';
import { createContext } from 'react';

type Interaction = {
  id: string;
  objectID: unknown;
  action: string;
  timestamp: number;
};

type TrialState = {
  interactions: Array<Interaction>;
};

export function createTrialProvenance() {
  const registry = Registry.create();
  const saveInteractionAction = registry.register(
    'save-interaction',
    (state, interaction: Omit<Interaction, 'timestamp'>) => {
      state.interactions.push({ ...interaction, timestamp: Date.now() });
    }
  );

  const trrack = initializeTrrack<TrialState>({
    registry,
    initialState: {
      interactions: [],
    },
  });

  return {
    trrack,
    actions: {
      saveInteraction(label: string, args: Omit<Interaction, 'timestamp'>) {
        trrack.apply(label, saveInteractionAction(args));
      },
    },
  };
}

export type TrialProvenance = ReturnType<
  typeof createTrialProvenance
>['trrack'];
export type TrialProvenanceActions = ReturnType<
  typeof createTrialProvenance
>['actions'];

export const TrialProvenanceContext = createContext<{
  trrack: TrialProvenance;
  actions: TrialProvenanceActions;
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
}>(null!);
