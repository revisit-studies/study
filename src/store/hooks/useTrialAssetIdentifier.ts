import { useRef } from 'react';
import { useCurrentIdentifier } from '../../routes/utils';
import { useStoreSelector } from '../store';
import { useStudyConfig } from './useStudyConfig';
import { useGlobalStoreSavePending } from './useGlobalStoreSavePending';

/** Each recorded entry has its own asset key; accepted provenance retains the reference. */
export function useTrialAssetIdentifier() {
  const identifier = useCurrentIdentifier();
  const revision = useStoreSelector((state) => state.globalStoreRevision ?? 0);
  const enabled = useStudyConfig().globalVariables !== undefined;
  const savePending = useGlobalStoreSavePending();
  const entry = useRef<{ identifier: string; enabled: boolean; key: string } | undefined>(undefined);
  // Keep the entry's key through submission; accepting it increments the revision
  // before the recorder's final chunk is delivered during navigation.
  if (entry.current?.identifier !== identifier || entry.current.enabled !== enabled) {
    if (savePending) {
      entry.current = undefined;
      return undefined;
    }
    entry.current = { identifier, enabled, key: enabled ? `${identifier}__global_${revision}` : identifier };
  }
  return entry.current.key;
}
