import { useAppSelector } from '../store';

export function useStudyConfig() {
  return useAppSelector((state) => state.unTrrackedSlice.config);
}
