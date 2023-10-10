import { useAppSelector } from '../store';
import { useCurrentStep } from '../../routes';
import { TrialRecord, TrialResult } from '../types';
import { useCurrentTrial } from './useCurrentTrial';

export function useGetStudyOrder(): TrialResult | null {
    const config = useAppSelector((state) => state.unTrrackedSlice.config);
    const study = useAppSelector((state) => state.trrackedSlice);

    const currentStep = useCurrentStep();
    const currentTrial = useCurrentTrial();

    const type = config.components[currentStep]?.type;

    const status = (study[currentStep] as any as TrialResult);


    return status;
}
