import type { JumpFunctionParameters, JumpFunctionReturnVal } from '../../../store/types';
import { parseTrialOrder } from '../../../utils/parseTrialOrder';

export default function dynamic({ answers, currentStep, store }: JumpFunctionParameters<never>): JumpFunctionReturnVal {
  const completed = Object.values(answers).filter((answer) => parseTrialOrder(answer.trialOrder).step === currentStep && answer.endTime > 0);
  return completed.length >= 2 ? { component: null } : {
    component: 'dynamicPurchase',
    parameters: { iteration: completed.length + 1, budgetAtGeneration: store.budget },
  };
}
