import { useStoreSelector } from '../store';

/** The accepted revision changes before navigation releases the submission lock. */
export function useGlobalStoreSavePending() {
  return useStoreSelector((state) => state.globalStoreSubmitting
    && (state.globalStoreRevision ?? 0) === (state.globalStorePendingRevision ?? 0));
}
