import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  useEffect, useMemo, useState,
} from 'react';
import {
  useFlatSequence, useStoreActions, useStoreDispatch, useStoreSelector,
} from '../store/store';
import { decryptIndex, encryptIndex } from '../utils/encryptDecryptIndex';
import { parseTrialOrder } from '../utils/parseTrialOrder';
import { JumpFunctionParameters, JumpFunctionReturnVal } from '../store/types';
import { findFuncBlock } from '../utils/getSequenceFlatMap';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { getComponent } from '../utils/handleComponentInheritance';
import { loadPublicModule } from '../utils/publicModules';

export function useStudyId(): string {
  const { studyId } = useParams();

  return `${studyId}`;
}

export function useCurrentStep() {
  const { index } = useParams();
  const answers = useStoreSelector((state) => state.answers);

  const decrypted = useMemo(() => {
    if (index === undefined) {
      return 0;
    }

    if (index.startsWith('reviewer-') || index.startsWith('__')) {
      return index;
    }

    return decryptIndex(index);
  }, [index]);

  const [searchParams] = useSearchParams();

  const currentTrial = searchParams.get('currentTrial') || '';
  const currentTrialOrder = currentTrial ? answers[currentTrial]?.trialOrder : undefined;
  const { step: currentTrialStep } = parseTrialOrder(currentTrialOrder);

  if (currentTrial && currentTrialStep !== null) {
    return currentTrialStep;
  }

  return decrypted;
}

export function useCurrentComponent(): string {
  const { funcIndex } = useParams();
  const _answers = useStoreSelector((state) => state.answers);
  const [searchParams] = useSearchParams();
  const studyConfig = useStudyConfig();
  const currentStep = useCurrentStep();
  const flatSequence = useFlatSequence();
  const navigate = useNavigate();
  const studyId = useStudyId();
  const storeDispatch = useStoreDispatch();
  const { pushToFuncSequence } = useStoreActions();
  const currentTrial = searchParams.get('currentTrial') || '';
  const currentTrialOrder = currentTrial ? _answers[currentTrial]?.trialOrder : undefined;
  const { step: currentTrialStep, funcIndex: currentTrialFuncIndex } = parseTrialOrder(currentTrialOrder);

  const [indexWhenSettingComponentName, setIndexWhenSettingComponentName] = useState<number | null>(null);

  const currentComponent = useMemo(() => (typeof currentStep === 'number' ? getComponent(flatSequence[currentStep], studyConfig) : currentStep.includes('reviewer-') || currentStep.startsWith('__') ? currentStep : null), [currentStep, flatSequence, studyConfig]);

  const [compName, setCompName] = useState('__dynamicLoading');

  const nextFuncLoader = useMemo(() => {
    if (typeof currentStep === 'number' && !currentComponent) {
      const block = findFuncBlock(flatSequence[currentStep], studyConfig.sequence);

      if (!block) {
        return null;
      }

      return block.functionPath;
    }
    return null;
  }, [currentComponent, currentStep, flatSequence, studyConfig.sequence]);

  useEffect(() => {
    if (!funcIndex && nextFuncLoader && typeof currentStep === 'number') {
      navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(currentTrialStep === currentStep && currentTrialFuncIndex !== null ? currentTrialFuncIndex : 0)}${window.location.search}`);
    }
  }, [currentStep, currentTrialFuncIndex, currentTrialStep, funcIndex, navigate, nextFuncLoader, studyId]);

  useEffect(() => {
    if (typeof currentStep !== 'number' || currentTrialStep === null || currentTrialStep !== currentStep || !funcIndex) {
      return;
    }

    const decryptedFuncIndex = decryptIndex(funcIndex);
    if (currentTrialFuncIndex === null) {
      navigate(`/${studyId}/${encryptIndex(currentStep)}${window.location.search}`);
      return;
    }

    if (decryptedFuncIndex !== currentTrialFuncIndex) {
      navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(currentTrialFuncIndex)}${window.location.search}`);
    }
  }, [currentStep, currentTrialFuncIndex, currentTrialStep, funcIndex, navigate, studyId]);

  useEffect(() => {
    let isMounted = true;

    if (typeof currentStep === 'number') {
      const component = getComponent(flatSequence[currentStep], studyConfig);

      const funcName = flatSequence[currentStep];
      const decryptedFuncIndex = funcIndex ? decryptIndex(funcIndex) : 0;

      // Check if answer exists for this index, if so get the component name and return early
      const currentAnswer = Object.entries(_answers).find(([key, _]) => key.startsWith(`${funcName}_${currentStep}_`) && key.endsWith(`${decryptedFuncIndex}`));
      const answerCompName = currentAnswer ? currentAnswer[1].componentName : null;
      if (answerCompName !== null) {
        setCompName(answerCompName);
        setIndexWhenSettingComponentName(decryptedFuncIndex);
        return;
      }

      // in a func component
      if (!component && nextFuncLoader !== null) {
        loadPublicModule(nextFuncLoader).then((module) => {
          if (!isMounted) {
            return;
          }

          const loadedModule = module as { default?: (params: JumpFunctionParameters<unknown>) => JumpFunctionReturnVal };
          if (!loadedModule.default) {
            setCompName('__dynamicLoading');
            setIndexWhenSettingComponentName(null);
            return;
          }

          const { component: currCompName, parameters: _params, correctAnswer } = loadedModule.default({
            answers: _answers,
            customParameters: findFuncBlock(flatSequence[currentStep], studyConfig.sequence)?.parameters,
            currentStep,
            currentBlock: flatSequence[currentStep],
          });

          if (currCompName !== null) {
            if (funcIndex) {
              setCompName(currCompName);
              setIndexWhenSettingComponentName(decryptedFuncIndex);

              storeDispatch(pushToFuncSequence({
                component: currCompName,
                funcName,
                index: currentStep,
                funcIndex: decryptedFuncIndex,
                parameters: _params || undefined,
                correctAnswer: correctAnswer || undefined,
              }));
            }
          } else {
            setCompName('__dynamicLoading');
            setIndexWhenSettingComponentName(null);

            navigate(`/${studyId}/${encryptIndex(currentStep + 1)}${window.location.search}`);
          }
        });
      }
    }

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, funcIndex, nextFuncLoader]);

  if (typeof currentStep === 'number' && flatSequence[currentStep] === 'end') {
    return 'end';
  } if (currentComponent) {
    return typeof currentStep === 'number' ? flatSequence[currentStep] : currentStep.replace('reviewer-', '');
  }

  return indexWhenSettingComponentName !== null && funcIndex && decryptIndex(funcIndex) === indexWhenSettingComponentName ? compName : '__dynamicLoading';
}

export function useCurrentIdentifier(): string {
  const currentStep = useCurrentStep();

  const participantSequence = useFlatSequence();
  const currentComponent = useCurrentComponent();

  const { funcIndex } = useParams();
  const identifier = useMemo(() => (funcIndex && typeof currentStep === 'number' ? `${participantSequence[currentStep]}_${currentStep}_${currentComponent}_${decryptIndex(funcIndex)}` : `${currentComponent}_${currentStep}`), [currentComponent, currentStep, funcIndex, participantSequence]);

  return identifier;
}
