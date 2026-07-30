import { createContext, useContext } from 'react';

const StartupInteractionContext = createContext(false);

export const StartupInteractionProvider = StartupInteractionContext.Provider;

export function useStartupInteractionBlocked() {
  return useContext(StartupInteractionContext);
}
