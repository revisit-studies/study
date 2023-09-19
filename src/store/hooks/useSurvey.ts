import { useAppSelector } from '../index';

export function useSurvey() {
  const { survey } = useAppSelector((state) => state.trrackedSlice);
  return survey;
}
