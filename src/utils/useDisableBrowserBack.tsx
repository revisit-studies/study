// rules-of-hooks is disabled because this is a custom hook that is only called in functional components
import { useEffect } from 'react';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { useCurrentStep } from '../routes/utils';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';

// Show the error modal when the participant tries to use the browser back button
export function useDisableBrowserBack(disabled = false) {
  const currentStep = useCurrentStep();
  const { setAlertModal } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const isAnalysis = useIsAnalysis();

  useEffect(() => {
    if (import.meta.env.PROD && !isAnalysis && !disabled) {
      window.history.pushState(null, '', window.location.href);
      window.onpopstate = () => {
        window.history.pushState(null, '', window.location.href);
        storeDispatch(setAlertModal({ show: true, message: 'Using the browser\'s back button is prohibited during the study.', title: 'Prohibited' }));
      };
      return () => {
        window.onpopstate = null;
      };
    }
    return () => {
      window.onpopstate = null;
    };
  }, [currentStep, disabled, isAnalysis, setAlertModal, storeDispatch]);
}
