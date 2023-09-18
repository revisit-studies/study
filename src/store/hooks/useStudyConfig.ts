import { useAppSelector } from '..';

export function useStudyConfig() {
  return useAppSelector((state) => state.unTrrackedSlice.config);
}
