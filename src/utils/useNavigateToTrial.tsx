import { useCallback } from 'react';
import { encryptIndex } from './encryptDecryptIndex';
import { PREFIX } from './Prefix';

export function useNavigateToTrial() {
  return useCallback((
    trialOrder: string,
    participantId: string,
    studyId: string,
    searchParams: Record<string, string> = {},
  ) => {
    const rejoined = trialOrder.split('_').map((index) => encryptIndex(+index)).join('/');
    const params = new URLSearchParams(searchParams);
    params.set('participantId', participantId);
    const url = `${studyId}/${rejoined}?${params.toString()}`;
    window.open(`${PREFIX}${url}`, '_blank');
  }, []);
}
