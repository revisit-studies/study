import { useStoreSelector } from '../store';

export function useStudyConfig() {
  return useStoreSelector((state) => state.config);
}
