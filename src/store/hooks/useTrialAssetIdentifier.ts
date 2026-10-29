import { useMemo } from 'react';
import { useCurrentIdentifier } from '../../routes/utils';
import { useStoreSelector } from '../store';
import { useStudyConfig } from './useStudyConfig';

/** Each recorded entry has its own asset key; accepted provenance retains the reference. */
export function useTrialAssetIdentifier() {
  const identifier = useCurrentIdentifier();
  const revision = useStoreSelector((state) => state.globalStoreRevision ?? 0);
  const enabled = useStudyConfig().globalVariables !== undefined;
  // Keep the entry's key through submission; accepting it increments the revision
  // before the recorder's final chunk is delivered during navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (enabled ? `${identifier}__global_${revision}` : identifier), [identifier, enabled]);
}
