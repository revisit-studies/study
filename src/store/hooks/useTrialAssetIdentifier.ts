import { useContext } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCurrentIdentifier } from '../../routes/utils';
import { StudyStoreContext } from '../store';
import { useStudyConfig } from './useStudyConfig';
import { useGlobalStoreSavePending } from './useGlobalStoreSavePending';

/** Each recorded entry has its own asset key; accepted provenance retains the reference. */
export function useTrialAssetIdentifier() {
  const identifier = useCurrentIdentifier();
  const context = useContext(StudyStoreContext);
  const enabled = useStudyConfig().globalVariables !== undefined;
  const savePending = useGlobalStoreSavePending();
  if (!enabled) return identifier;
  // Recorder and submitter share one visit key, including through acceptance and delayed mounts.
  if (context.trialAssetEntry?.identifier === identifier) return context.trialAssetEntry.key;
  if (savePending) {
    context.trialAssetEntry = undefined;
    return undefined;
  }
  context.trialAssetEntry = { identifier, key: `${identifier}__global_${uuidv4()}` };
  return context.trialAssetEntry.key;
}
