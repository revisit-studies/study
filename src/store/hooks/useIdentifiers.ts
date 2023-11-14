import { useStoreSelector } from '../store';

export function useIdentifiers() {
  const { studyIdentifiers } = useStoreSelector((state) => state.trrackedSlice);
  return studyIdentifiers;
}
