import {
  createContext, ReactNode, useContext, useEffect, useInsertionEffect, useLayoutEffect, useMemo, useRef,
} from 'react';
import type { ConfigureTrrackOptions, Trrack } from '@trrack/core';
import { appendProvenanceTraversalEvent } from '../provenance';
import { initializeResumedTrrack } from '../resumeProvenance';
import type { TrrackedProvenance, UseTrrack } from '../types';

export type ProvenanceChangeHandler = (provenance: TrrackedProvenance) => void;

interface RevisitProvenanceContextValue {
  onChange: ProvenanceChangeHandler;
  provenance?: TrrackedProvenance;
  onGraphReady?: () => () => void;
}
const RevisitProvenanceContext = createContext<RevisitProvenanceContextValue | null>(null);

export function useManagedTrrack<State, Event extends string = string>(
  options: ConfigureTrrackOptions<State, Event>,
  onProvenanceChange: ProvenanceChangeHandler,
  scopeKey: string = 'default',
  retainedProvenance?: TrrackedProvenance,
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
      trrack: initializeResumedTrrack(options, retainedProvenance),
    };
  }

  const { trrack } = trrackRef.current;

  useInsertionEffect(() => {
    previousProvenanceRef.current = retainedProvenance;
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
    if (!retainedProvenance) publishProvenance();

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
  const context = useContext(RevisitProvenanceContext);

  if (!context) {
    throw new Error('useRevisitTrrack must be used within a reVISit React stimulus.');
  }

  const trrack = useManagedTrrack(options, context.onChange, 'stimulus', context.provenance);
  const { onGraphReady } = context;
  useLayoutEffect(() => onGraphReady?.(), [onGraphReady]);
  return trrack;
}

export function RevisitProvenanceProvider({
  children,
  onProvenanceChange,
  provenance,
  onGraphReady,
}: {
  children: (useTrrack: UseTrrack) => ReactNode;
  onProvenanceChange: ProvenanceChangeHandler;
  provenance?: TrrackedProvenance;
  onGraphReady?: () => () => void;
}) {
  const value = useMemo(() => ({ onChange: onProvenanceChange, provenance, onGraphReady }), [onProvenanceChange, provenance, onGraphReady]);
  return (
    <RevisitProvenanceContext.Provider value={value}>
      {children(useRevisitTrrack)}
    </RevisitProvenanceContext.Provider>
  );
}
