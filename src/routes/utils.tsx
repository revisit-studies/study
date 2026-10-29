import { useNavigate, useParams } from 'react-router';
import {
  useEffect, useMemo, useState,
} from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import {
  useFlatSequence, useStoreActions, useStoreDispatch, useStoreSelector,
} from '../store/store';
import { decryptIndex, encryptIndex } from '../utils/encryptDecryptIndex';
import { JumpFunctionParameters, JumpFunctionReturnVal } from '../store/types';
import { findFuncBlock } from '../utils/getSequenceFlatMap';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { getComponent } from '../utils/handleComponentInheritance';
import { getGlobalStoreContextBeforeTrial } from '../store/globalStoreProvenance';
import { useGlobalStoreSavePending } from '../store/hooks/useGlobalStoreSavePending';
import { useStartupInteractionBlocked } from '../components/StartupContext';

export function useStudyId(): string {
  const { studyId } = useParams();

  return `${studyId}`;
}

export function useCurrentStep() {
  const { index } = useParams();

  const decrypted = useMemo(() => {
    if (index === undefined) {
      return 0;
    }

    if (index.startsWith('reviewer-') || index.startsWith('__')) {
      return index;
    }

    return decryptIndex(index);
  }, [index]);

  return decrypted;
}

const modules = import.meta.glob(
  [
    '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
    '!../public/**/*.spec.{mjs,js,mts,ts,jsx,tsx}',
  ],
  { eager: true },
) as Record<string, ModuleNamespace>;

export function useCurrentComponent(): string {
  const savePending = useGlobalStoreSavePending();
  const isAnalysis = useIsAnalysis();
  const { funcIndex } = useParams();
  const globalVariables = useStoreSelector((state) => state.globalVariables);
  const globalGraph = useStoreSelector((state) => state.globalStoreGraph);
  const _answers = useStoreSelector((state) => state.answers);
  const studyConfig = useStudyConfig();
  const participantSequence = useStoreSelector((state) => state.sequence);
  const currentStep = useCurrentStep();
  const flatSequence = useFlatSequence();
  const navigate = useNavigate();
  const studyId = useStudyId();
  const storeDispatch = useStoreDispatch();
  const { pushToFuncSequence } = useStoreActions();
  const startupInteractionBlocked = useStartupInteractionBlocked();

  const currentComponent = useMemo(() => (typeof currentStep === 'number' ? getComponent(flatSequence[currentStep], studyConfig) : currentStep.includes('reviewer-') || currentStep.startsWith('__') ? currentStep : null), [currentStep, flatSequence, studyConfig]);

  const generatedScope = typeof currentStep === 'number'
    ? `${flatSequence[currentStep]}_${currentStep}_${funcIndex ? decryptIndex(funcIndex) : 0}` : currentStep;
  const [generatedComponent, setGeneratedComponent] = useState<{ name: string; scope: string } | null>(null);
  // Every hook instance must resolve an existing dynamic trial before consumers snapshot its data.
  const savedComponentName = useMemo(() => {
    if (typeof currentStep !== 'number' || currentComponent) return undefined;
    const funcName = flatSequence[currentStep];
    const index = funcIndex ? decryptIndex(funcIndex) : 0;
    return Object.entries(_answers).find(([key, answer]) => key.startsWith(`${funcName}_${currentStep}_`)
      && key.endsWith(`_${index}`)
      && typeof answer.componentName === 'string'
      && answer.componentName.length > 0
      && Boolean(getComponent(answer.componentName, studyConfig)))?.[1].componentName;
  }, [_answers, currentComponent, currentStep, flatSequence, funcIndex, studyConfig]);

  const nextFunc:((params: JumpFunctionParameters<unknown>) => JumpFunctionReturnVal) | null = useMemo(() => {
    if (typeof currentStep === 'number' && !currentComponent) {
      const block = findFuncBlock(flatSequence[currentStep], studyConfig.sequence);

      if (!block) {
        return null;
      }

      const reactPath = `../public/${block.functionPath}`;
      const newFunc = reactPath in modules ? modules[reactPath].default : null;

      return newFunc;
    }
    return null;
  }, [currentComponent, currentStep, flatSequence, studyConfig.sequence]);

  useEffect(() => {
    if (!startupInteractionBlocked && !savePending && !funcIndex && nextFunc && typeof currentStep === 'number') {
      navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(0)}${window.location.search}`);
    }
  }, [startupInteractionBlocked, savePending, currentStep, funcIndex, navigate, nextFunc, studyId]);

  useEffect(() => {
    if (savePending) return;
    if (typeof currentStep === 'number') {
      const component = getComponent(flatSequence[currentStep], studyConfig);

      const funcName = flatSequence[currentStep];
      const decryptedFuncIndex = funcIndex ? decryptIndex(funcIndex) : 0;

      if (savedComponentName) return;

      if (!component && isAnalysis && studyConfig.globalVariables !== undefined) {
        setGeneratedComponent({ name: 'Notfound', scope: generatedScope });
        return;
      }
      // in a func component
      if (!component && nextFunc !== null) {
        const configuredBlock = findFuncBlock(flatSequence[currentStep], studyConfig.sequence);
        const participantBlock = findFuncBlock(flatSequence[currentStep], participantSequence);
        const customParameters = configuredBlock?.parameters || participantBlock?.parameters
          ? {
            ...(configuredBlock?.parameters || {}),
            ...(participantBlock?.parameters || {}),
          }
          : undefined;
        const context = studyConfig.globalVariables !== undefined
          ? getGlobalStoreContextBeforeTrial(globalGraph, studyConfig.globalVariables, currentStep, decryptedFuncIndex)
          : { store: globalVariables, answers: _answers };
        const { component: currCompName, parameters: _params, correctAnswer } = nextFunc({
          store: Object.freeze({ ...context.store }),
          answers: context.answers,
          customParameters,
          currentStep,
          currentBlock: flatSequence[currentStep],
        });

        if (currCompName !== null) {
          if (funcIndex) {
            setGeneratedComponent({ name: currCompName, scope: generatedScope });

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
          setGeneratedComponent(null);

          if (!startupInteractionBlocked) {
            navigate(`/${studyId}/${encryptIndex(currentStep + 1)}${window.location.search}`);
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupInteractionBlocked, savePending, globalGraph, currentStep, funcIndex, participantSequence, studyConfig.sequence, savedComponentName, generatedScope, isAnalysis]);

  if (typeof currentStep === 'number' && flatSequence[currentStep] === 'end') {
    return 'end';
  } if (currentComponent) {
    return typeof currentStep === 'number' ? flatSequence[currentStep] : currentStep.replace('reviewer-', '');
  }

  if (savedComponentName && funcIndex) return savedComponentName;
  return generatedComponent && funcIndex && generatedComponent.scope === generatedScope
    ? generatedComponent.name : '__dynamicLoading';
}

export function useCurrentIdentifier(): string {
  const currentStep = useCurrentStep();

  const participantSequence = useFlatSequence();
  const currentComponent = useCurrentComponent();

  const { funcIndex } = useParams();
  const identifier = useMemo(() => (funcIndex && typeof currentStep === 'number' ? `${participantSequence[currentStep]}_${currentStep}_${currentComponent}_${decryptIndex(funcIndex)}` : `${currentComponent}_${currentStep}`), [currentComponent, currentStep, funcIndex, participantSequence]);

  return identifier;
}
