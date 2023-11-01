import { useAppSelector } from '../store';

export function useIdentifiers() {
  const { studyIdentifiers } = useAppSelector((state) => state.trrackedSlice);
  return studyIdentifiers;
}
