import { useSearchParams } from 'react-router-dom';

export function useIsAnalysis() {
  const [searchParams] = useSearchParams();

  return !!searchParams.get('participantId');
}
