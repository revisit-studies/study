import { useAppSelector } from '../index';

export function useIdentifiers() {
  const { studyIdentifiers } = useAppSelector((state) => state.trrackedSlice);
  return studyIdentifiers;
}
