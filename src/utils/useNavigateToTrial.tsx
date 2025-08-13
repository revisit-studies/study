import { useCallback } from 'react';
import { encryptIndex } from './encryptDecryptIndex';
import { PREFIX } from './Prefix';

export function useNavigateToTrial() {
  return useCallback((trialOrder: string, participantId: string, studyId: string, timeString?: string) => {
    const rejoined = trialOrder.split('_').map((index) => encryptIndex(+index)).join('/');

    let url = `${studyId}/${rejoined}?participantId=${participantId}`;

    if (timeString) {
      url += `&t=${timeString}`;
    }

    window.open(`${PREFIX}${url}`, '_blank');
  }, []);
}
