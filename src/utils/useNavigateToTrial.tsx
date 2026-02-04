import { useCallback } from 'react';
import { encryptIndex } from './encryptDecryptIndex';
import { PREFIX } from './Prefix';

export function useNavigateToTrial() {
  return useCallback((trialOrder: string, participantId: string, studyId: string, condition?: string) => {
    const rejoined = trialOrder.split('_').map((index) => encryptIndex(+index)).join('/');
    const conditionParam = condition ? `&condition=${condition}` : '';
    const url = `${studyId}/${rejoined}?participantId=${participantId}${conditionParam}`;
    window.open(`${PREFIX}${url}`, '_blank');
  }, []);
}
