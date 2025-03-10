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

  const currentComponent = useMemo(() => (typeof currentStep === 'number' ? getComponent(flatSequence[currentStep], studyConfig) : null), [currentStep, flatSequence, studyConfig]);

  const [compName, setCompName] = useState('__dynamicLoading');

  const nextFunc:(({ components, answers, sequenceSoFar }: JumpFunctionParameters<unknown>) => JumpFunctionReturnVal) | null = useMemo(() => {
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

      // in a func component
      if (!component && nextFunc !== null) {
        const { component: currCompName, parameters: _params, correctAnswer } = nextFunc({
          components: [], answers: _answers, sequenceSoFar: [], customParameters: findFuncBlock(flatSequence[currentStep], studyConfig.sequence)?.parameters,
        });
        if (currCompName !== null) {
          setCompName(currCompName);

          storeDispatch(pushToFuncSequence({
            component: currCompName,
            funcName: flatSequence[currentStep],
            index: currentStep,
            funcIndex: funcIndex ? decryptIndex(funcIndex) : 0,
            parameters: _params || undefined,
            correctAnswer: correctAnswer || undefined,
          }));
        } else {
          setCompName('__dynamicLoading');
          navigate(`/${studyId}/${encryptIndex(currentStep + 1)}${window.location.search}`);
        }
      }
    }
  }, [_answers, currentStep, flatSequence, funcIndex, navigate, nextFunc, pushToFuncSequence, storeDispatch, studyConfig, studyId]);

  return (typeof currentStep === 'number' && flatSequence[currentStep] === 'end' ? 'end'
    : currentComponent ? (
      typeof currentStep === 'number' ? flatSequence[currentStep] : currentStep.replace('reviewer-', '')
    ) : compName);
}

export function useCurrentIdentifier(): string {
  const currentStep = useCurrentStep();

  const participantSequence = useFlatSequence();
  const currentComponent = useCurrentComponent();

  const { funcIndex } = useParams();
  const identifier = useMemo(() => (funcIndex && typeof currentStep === 'number' ? `${participantSequence[currentStep]}_${currentStep}_${currentComponent}_${decryptIndex(funcIndex)}` : `${currentComponent}_${currentStep}`), [currentComponent, currentStep, funcIndex, participantSequence]);

  return identifier;
}
