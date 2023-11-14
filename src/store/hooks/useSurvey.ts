import { useStoreSelector } from '../store';

export function useSurvey() {
  const { survey } = useStoreSelector((state) => state.trrackedSlice);
  return survey;
}
