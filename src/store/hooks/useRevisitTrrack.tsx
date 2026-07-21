import {
  createContext, ReactNode, useContext, useEffect, useInsertionEffect, useRef,
} from 'react';
import { initializeTrrack } from '@trrack/core';
import type { ConfigureTrrackOptions, Trrack } from '@trrack/core';
import { appendProvenanceTraversalEvent } from '../provenance';
import type { TrrackedProvenance, UseTrrack } from '../types';

export type ProvenanceChangeHandler = (provenance: TrrackedProvenance) => void;

const RevisitProvenanceContext = createContext<ProvenanceChangeHandler | null>(null);

export function useManagedTrrack<State, Event extends string = string>(
  options: ConfigureTrrackOptions<State, Event>,
  onProvenanceChange: ProvenanceChangeHandler,
  scopeKey: string = 'default',
): Trrack<State, Event> {
  const trrackRef = useRef<{
    scopeKey: string;
    trrack: Trrack<State, Event>;
  } | null>(null);
  const previousProvenanceRef = useRef<TrrackedProvenance | undefined>(undefined);
  const pendingProvenanceRef = useRef<TrrackedProvenance[]>([]);
  const activeHandlerRef = useRef<ProvenanceChangeHandler | null>(null);

  if (!trrackRef.current || trrackRef.current.scopeKey !== scopeKey) {
    trrackRef.current = {
      scopeKey,
      trrack: initializeTrrack(options),
    };
  }

  const { trrack } = trrackRef.current;

  useInsertionEffect(() => {
    previousProvenanceRef.current = undefined;
    pendingProvenanceRef.current = [];
    activeHandlerRef.current = null;

    const publishProvenance = () => {
      const provenance = appendProvenanceTraversalEvent(
        previousProvenanceRef.current,
        trrack.graph.backend as TrrackedProvenance,
        Date.now(),
      );
      previousProvenanceRef.current = provenance;
      if (activeHandlerRef.current) {
        activeHandlerRef.current(provenance);
      } else {
        pendingProvenanceRef.current.push(provenance);
      }
    };

    const unsubscribe = trrack.currentChange(publishProvenance);
    publishProvenance();

    return () => {
      unsubscribe();
    };
  }, [trrack]);

  useEffect(() => {
    activeHandlerRef.current = onProvenanceChange;
    pendingProvenanceRef.current.forEach(onProvenanceChange);
    pendingProvenanceRef.current = [];

    return () => {
      activeHandlerRef.current = null;
    };
  }, [onProvenanceChange, trrack]);

  return trrack;
}

/**
 * Creates a Trrack instance whose complete traversal history is automatically
 * reported to reVISit for participant replay.
 */
function useRevisitTrrack<State, Event extends string = string>(
  options: ConfigureTrrackOptions<State, Event>,
): Trrack<State, Event> {
  const onProvenanceChange = useContext(RevisitProvenanceContext);

  if (!onProvenanceChange) {
    throw new Error('useRevisitTrrack must be used within a reVISit React stimulus.');
  }

  return useManagedTrrack(options, onProvenanceChange);
}

export function RevisitProvenanceProvider({
  children,
  onProvenanceChange,
}: {
  children: (useTrrack: UseTrrack) => ReactNode;
  onProvenanceChange: ProvenanceChangeHandler;
}) {
  return (
    <RevisitProvenanceContext.Provider value={onProvenanceChange}>
      {children(useRevisitTrrack)}
    </RevisitProvenanceContext.Provider>
  );
}
