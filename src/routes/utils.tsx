import { useNavigate, useParams } from 'react-router';
import {
  useEffect, useMemo, useState,
} from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import {
  useFlatSequence, useStoreActions, useStoreDispatch, useStoreSelector,
} from '../store/store';
import { decryptIndex, encryptIndex } from '../utils/encryptDecryptIndex';
import { JumpFunctionParameters, JumpFunctionReturnVal } from '../store/types';
import { findFuncBlock } from '../utils/getSequenceFlatMap';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { getComponent } from '../utils/handleComponentInheritance';

export function useStudyId(): string {
  const { studyId } = useParams();

  return `${studyId}`;
}

export function useCurrentStep() {
  const { index } = useParams();
  if (index === undefined) {
    return 0;
  }

  if (index.startsWith('reviewer-') || index.startsWith('__')) {
    return index;
  }

  return decryptIndex(index);
}

const modules = import.meta.glob(
  '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
  { eager: true },
);

export function useCurrentComponent(): string {
  const { funcIndex } = useParams();
  const _answers = useStoreSelector((state) => state.answers);
  const studyConfig = useStudyConfig();
  const currentStep = useCurrentStep();
  const flatSequence = useFlatSequence();
  const navigate = useNavigate();
  const studyId = useStudyId();
  const storeDispatch = useStoreDispatch();
  const { pushToFuncSequence } = useStoreActions();

  const [indexWhenSettingComponentName, setIndexWhenSettingComponentName] = useState<number | null>(null);

  const currentComponent = useMemo(() => (typeof currentStep === 'number' ? getComponent(flatSequence[currentStep], studyConfig) : currentStep.includes('reviewer-') || currentStep.startsWith('__') ? currentStep : null), [currentStep, flatSequence, studyConfig]);

  const [compName, setCompName] = useState('__dynamicLoading');

  const nextFunc:((params: JumpFunctionParameters<unknown>) => JumpFunctionReturnVal) | null = useMemo(() => {
    if (typeof currentStep === 'number' && !currentComponent) {
      const block = findFuncBlock(flatSequence[currentStep], studyConfig.sequence);

      if (!block) {
        return null;
      }

      const reactPath = `../public/${block.functionPath}`;
      const newFunc = reactPath in modules ? (modules[reactPath] as ModuleNamespace).default : null;

      return newFunc;
    }
    return null;
  }, [currentComponent, currentStep, flatSequence, studyConfig.sequence]);

  useEffect(() => {
    if (!funcIndex && nextFunc && typeof currentStep === 'number') {
      navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(0)}${window.location.search}`);
    }
  }, [currentStep, funcIndex, navigate, nextFunc, studyId]);

  useEffect(() => {
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
      if (!component && nextFunc !== null) {
        const { component: currCompName, parameters: _params, correctAnswer } = nextFunc({
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
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, funcIndex]);

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
