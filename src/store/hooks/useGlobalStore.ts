import {
  useCallback, useContext, useEffect, useMemo, useRef,
} from 'react';
import { useCurrentIdentifier } from '../../routes/utils';
import { StudyStoreContext, useStoreSelector } from '../store';
import { useStudyConfig } from './useStudyConfig';
import { getGlobalStoreEntryValues } from '../globalStoreProvenance';
import type { RegisterGlobalStoreUpdater } from '../types';

/** The committed entry snapshot for the current trial, including when revisiting it. */
export function useGlobalStore() {
  const identifier = useCurrentIdentifier();
  const graph = useStoreSelector((state) => state.globalStoreGraph);
  const replayValues = useStoreSelector((state) => (state.analysisGlobalStoreIdentifier === identifier ? state.analysisProvState.globalStore?.values : undefined));
  const definitions = useStudyConfig().globalVariables;
  return useMemo(() => Object.freeze(replayValues ?? getGlobalStoreEntryValues(graph, definitions ?? {}, identifier)), [graph, definitions, identifier, replayValues]);
}

export function useGlobalStoreUpdaterRegistration(): RegisterGlobalStoreUpdater {
  const context = useContext(StudyStoreContext);
  const identifier = useCurrentIdentifier();
  const registered = useRef<Parameters<RegisterGlobalStoreUpdater>[0] | undefined>(undefined);
  useEffect(() => () => {
    if (registered.current && context.globalStoreUpdaters.get(identifier) === registered.current) context.globalStoreUpdaters.delete(identifier);
  }, [context, identifier]);
  return useCallback((updater) => {
    const registry = context.globalStoreUpdaters;
    if (registry.has(identifier)) throw new Error('Only one global store updater may be registered for a stimulus.');
    registry.set(identifier, updater);
    registered.current = updater;
    return () => { if (registry.get(identifier) === updater) registry.delete(identifier); };
  }, [context, identifier]);
}
