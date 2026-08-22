import { useMemo } from 'react';
import { useParams } from 'react-router';
import { useFlatSequence, useStoreSelector } from '../store';
import { useCurrentComponent, useCurrentStep } from '../../routes/utils';
import { decryptIndex } from '../../utils/encryptDecryptIndex';

// Shared Handlebars data frame for every templated string (instructions, help text, markdown
// stimuli, response prompts). answers/flatSequence/currentStep let the `lookupAnswers` and
// `lookupAnswersRel` helpers (src/utils/handlebars.ts) walk prior trials to pull in earlier
// answers. currentComponent/funcIndex are only non-trivial inside a dynamic block, where a
// single flatSequence step fans out into many answer-bearing iterations; without them,
// `lookupAnswersRel` can't tell which iteration is "current" and relative lookups would be
// ambiguous.
export function useTemplateAnswerContext() {
  const answers = useStoreSelector((state) => state.answers);
  const flatSequence = useFlatSequence();
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();
  const { funcIndex } = useParams();
  const decryptedFuncIndex = funcIndex ? decryptIndex(funcIndex) : undefined;
  return useMemo(
    () => ({
      answers, flatSequence, currentStep, currentComponent, funcIndex: decryptedFuncIndex,
    }),
    [answers, flatSequence, currentStep, currentComponent, decryptedFuncIndex],
  );
}
