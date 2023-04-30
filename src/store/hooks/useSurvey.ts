import { useAppSelector } from '../index';

export function useSurvey() {
  const { survey } = useAppSelector((state) => state.study);
  return survey;
}
