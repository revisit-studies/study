import { encryptIndex } from '../../../utils/encryptDecryptIndex';
import { parseTrialOrder } from '../../../utils/parseTrialOrder';

export function buildTaskNavigationTarget({
  answerIdentifier,
  trialOrder,
  isReplay,
  studyId,
  search,
}: {
  answerIdentifier: string;
  trialOrder: string;
  isReplay: boolean;
  studyId: string;
  search: string;
}) {
  const { step, funcIndex } = parseTrialOrder(trialOrder);
  if (step === null) {
    return null;
  }

  if (!isReplay) {
    return {
      pathname: `/analysis/stats/${studyId}/tagging/${encodeURIComponent(answerIdentifier)}`,
      search,
    };
  }

  const params = new URLSearchParams(search);
  params.set('currentTrial', answerIdentifier);
  const nextSearch = params.toString();

  return {
    pathname: funcIndex === null
      ? `/${studyId}/${encryptIndex(step)}`
      : `/${studyId}/${encryptIndex(step)}/${encryptIndex(funcIndex)}`,
    search: nextSearch ? `?${nextSearch}` : '',
  };
}
