import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStoreSelector,
  useStoreActions,
  useStoreDispatch,
  useAreResponsesValid,
  useFlatSequence,
} from '../store';
import { useCurrentComponent, useCurrentStep, useStudyId } from '../../routes/utils';

import { deepCopy } from '../../utils/deepCopy';
import { StoredAnswer, ValidationStatus } from '../types';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStoredAnswer } from './useStoredAnswer';
import { useWindowEvents } from './useWindowEvents';
import { findBlockForStep, findIndexOfBlock } from '../../utils/getSequenceFlatMap';
import { useStudyConfig } from './useStudyConfig';
import {
  Answer, IndividualComponent, InheritedComponent, StudyConfig,
} from '../../parser/types';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import { useIsAnalysis } from './useIsAnalysis';

function checkAllAnswersCorrect(answers: Record<string, Answer>, componentId: string, componentConfig: IndividualComponent | InheritedComponent, studyConfig: StudyConfig) {
  const componentName = componentId.slice(0, componentId.lastIndexOf('_'));

  // Find the matching component in the study config
  const foundConfigComponent = Object.entries(studyConfig.components).find(([configComponentId]) => configComponentId === componentName);
  const foundConfigComponentConfig = foundConfigComponent ? foundConfigComponent[1] : null;

  if (!foundConfigComponentConfig) {
    throw new Error(`Component ${componentName} could not be found in the study components.`);
  }

  if (!foundConfigComponentConfig.correctAnswer) {
    return true;
  }

  // Check that the response is matches the correct answer
  return foundConfigComponentConfig.correctAnswer.every((correctAnswerEntry) => answers[correctAnswerEntry.id] === correctAnswerEntry.answer);
}

export function useNextStep() {
  const currentStep = useCurrentStep();
  const participantSequence = useFlatSequence();
  const currentComponent = useCurrentComponent();
  const identifier = `${currentComponent}_${currentStep}`;

  const trialValidation = useStoreSelector((state) => state.trialValidation);
  const sequence = useStoreSelector((state) => state.sequence);
  const answers = useStoreSelector((state) => state.answers);
  const modes = useStoreSelector((state) => state.modes);

  const storeDispatch = useStoreDispatch();
  const {
    saveTrialAnswer, setIframeAnswers, setMatrixAnswersRadio, setMatrixAnswersCheckbox,
  } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const studyId = useStudyId();

  const dataCollectionEnabled = useMemo(() => modes.dataCollectionEnabled, [modes]);

  const areResponsesValid = useAreResponsesValid(identifier);

  // Status of the next button. If false, the next button should be disabled
  const isAnalysis = useIsAnalysis();
  const isNextDisabled = typeof currentStep !== 'number' || isAnalysis || !areResponsesValid;

  const storedAnswer = useStoredAnswer();

  const navigate = useNavigate();

  const studyConfig = useStudyConfig();

  const startTime = useMemo(() => Date.now(), []);

  const windowEvents = useWindowEvents();
  const goToNextStep = useCallback((collectData = true) => {
    if (typeof currentStep !== 'number') {
      return;
    }
    // Get answer from across the 3 response blocks and the provenance graph
    const trialValidationCopy = deepCopy(trialValidation[identifier]);
    const answer = Object.values(trialValidationCopy).reduce((acc, curr) => {
      if (Object.hasOwn(curr, 'values')) {
        return { ...acc, ...(curr as ValidationStatus).values };
      }
      return acc;
    }, {});
    const { provenanceGraph } = trialValidationCopy;
    const endTime = Date.now();

    const { incorrectAnswers, helpButtonClickedCount } = storedAnswer;

    // Get current window events. Splice empties the array and returns the removed elements, which handles clearing the array
    const currentWindowEvents = windowEvents && 'current' in windowEvents && windowEvents.current ? windowEvents.current.splice(0, windowEvents.current.length) : [];

    if (dataCollectionEnabled && storedAnswer.endTime === -1) { // === -1 means the answer has not been saved yet
      const toSave = {
        answer: collectData ? answer : {},
        startTime,
        endTime,
        incorrectAnswers,
        provenanceGraph,
        windowEvents: currentWindowEvents,
        timedOut: !collectData,
        helpButtonClickedCount,
      };
      storeDispatch(
        saveTrialAnswer({
          identifier,
          ...toSave,
        }),
      );
      // Update database
      if (storageEngine) {
        storageEngine.saveAnswers(
          {
            ...answers,
            [identifier]: toSave,
          },
        );
      }
      storeDispatch(setIframeAnswers({}));
      storeDispatch(setMatrixAnswersCheckbox(null));
      storeDispatch(setMatrixAnswersRadio(null));
    }

    let nextStep = currentStep + 1;

    // Traverse through the sequence to find the block the current component is in
    const blocksForStep = findBlockForStep(sequence, currentStep);

    // If the current component is in a block that has a skip block (or is nested in a block that has a skip block), we need to check if the skip block should be triggered
    const hasSkipBlock = blocksForStep !== null && (blocksForStep.some((block) => Object.hasOwn(block.currentBlock, 'skip') && block.currentBlock.skip !== undefined));

    // Get the answers with the new answer added, since above is dispatching and async, but we need it synchronously
    const answersWithNewAnswer = {
      ...answers,
      [identifier]: {
        answer, startTime, endTime, provenanceGraph, windowEvents: currentWindowEvents,
      },
    };

    // Check if the skip block should be triggered
    if (hasSkipBlock) {
      const skipConditions = [
        ...blocksForStep.flatMap((block) => (block.currentBlock.skip ? block.currentBlock.skip.map((condition) => ({ ...condition, firstIndex: block.firstIndex, lastIndex: block.lastIndex })) : [])),
      ];

      // Loop over all conditions, use `.some()` to stop early if the condition is met
      skipConditions.some((condition) => {
        let conditionIsTriggered = false;

        const validationCandidates = Object.fromEntries(Object.entries(answersWithNewAnswer).filter(([key]) => {
          const componentIndex = parseInt(key.slice(key.lastIndexOf('_') + 1), 10);
          return componentIndex >= condition.firstIndex && componentIndex <= currentStep;
        })) as unknown as StoredAnswer;

        // Slim down the validationCandidates to only include the skip condition's component
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const componentsToCheck = condition.check !== 'block' ? Object.entries(validationCandidates).filter(([key]) => key.slice(0, key.lastIndexOf('_')) === condition.name) : Object.entries(validationCandidates);

        // Make sure componentsToCheck array is well-formed
        if (componentsToCheck.length === 0) {
          return false;
        }
        if (componentsToCheck.some(([_, responseObj]) => !responseObj)) {
          throw new Error(`There are components with missing response objects for the skip condition: ${JSON.stringify(condition, null, 2)}`);
        }

        if (condition.check === 'response' || condition.check === 'responses') {
          const [componentId, response] = componentsToCheck[0]; // We will only check the first component that matches the condition

          // For a response check, we only need to check the specified response
          if (condition.check === 'response') {
            conditionIsTriggered = condition.comparison === 'equal' ? condition.value === response.answer[condition.responseId] : condition.value !== response.answer[condition.responseId];
          } else {
            // Check that the response is matches the correct answer
            conditionIsTriggered = !checkAllAnswersCorrect(response.answer, componentId, studyConfig.components[componentId.slice(0, componentId.lastIndexOf('_'))], studyConfig);
          }
        } else if (condition.check === 'block' || condition.check === 'repeatedComponent') {
          // If we have less than numCorrect or numIncorrect, there's no point in checking the condition
          if (componentsToCheck.length < condition.value) {
            return false;
          }

          // Check the candidates and count the number of correct and incorrect answers
          const correctAnswers = componentsToCheck.map(([componentName, responseObj]) => checkAllAnswersCorrect(responseObj.answer, componentName, studyConfig.components[componentName.slice(0, componentName.lastIndexOf('_'))], studyConfig));
          const numCorrect = correctAnswers.filter((correct) => correct).length;
          const numIncorrect = correctAnswers.length - numCorrect;

          // Check if the number of correct and incorrect answers match the condition
          conditionIsTriggered = (condition.condition === 'numCorrect' && numCorrect === condition.value) || (condition.condition === 'numIncorrect' && numIncorrect === condition.value);
        }

        if (conditionIsTriggered) {
          const nextStepIndex = participantSequence.indexOf(condition.to);
          const nextStepBlockIndex = nextStepIndex === -1 ? findIndexOfBlock(sequence, condition.to) : -1;
          nextStep = nextStepIndex === -1 ? nextStepBlockIndex : nextStepIndex;
          return true;
        }
        return false;
      });
    }

    navigate(`/${studyId}/${encryptIndex(nextStep)}${window.location.search}`);
  }, [currentStep, trialValidation, identifier, windowEvents, dataCollectionEnabled, storedAnswer, sequence, answers, startTime, navigate, studyId, storeDispatch, saveTrialAnswer, storageEngine, setIframeAnswers, setMatrixAnswersCheckbox, setMatrixAnswersRadio, studyConfig, participantSequence]);

  return {
    isNextDisabled,
    goToNextStep,
  };
}
