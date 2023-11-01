import { useAppSelector } from '../store';

export function useSurvey() {
  const { survey } = useAppSelector((state) => state.trrackedSlice);
  return survey;
}
