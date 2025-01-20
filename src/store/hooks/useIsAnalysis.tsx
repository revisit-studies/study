import { useSearchParams } from 'react-router';

export function useIsAnalysis() {
  const [searchParams] = useSearchParams();

  return !!searchParams.get('participantId');
}
