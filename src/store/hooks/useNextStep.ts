import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStoreSelector,
  useStoreActions,
  useStoreDispatch,
  useAreResponsesValid,
  useFlatSequence,
} from '../store';
import { useCurrentStep, useStudyId } from '../../routes/utils';

import { deepCopy } from '../../utils/deepCopy';
import { StoredAnswer, ValidationStatus } from '../types';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStoredAnswer } from './useStoredAnswer';
import { useWindowEvents } from './useWindowEvents';
import { findBlockForStep, findIndexOfBlock } from '../../utils/getSequenceFlatMap';
import { useStudyConfig } from './useStudyConfig';

export function useNextStep() {
  const currentStep = useCurrentStep();
  const participantSequence = useFlatSequence();
  const currentComponent = participantSequence[currentStep];
  const identifier = `${currentComponent}_${currentStep}`;

  const { trialValidation, sequence, answers } = useStoreSelector((state) => state);

  const status = useStoredAnswer();

  const storeDispatch = useStoreDispatch();
  const { saveTrialAnswer, setIframeAnswers } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const areResponsesValid = useAreResponsesValid(identifier);

  // Status of the next button. If false, the next button should be disabled
  const isNextDisabled = !areResponsesValid;

  const storedAnswer = status?.answer;

  const navigate = useNavigate();

  const studyConfig = useStudyConfig();

  const studyId = useStudyId();

  const startTime = useMemo(() => Date.now(), []);

  const windowEvents = useWindowEvents();
  const goToNextStep = useCallback(() => {
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

    // Get current window events. Splice empties the array and returns the removed elements, which handles clearing the array
    const currentWindowEvents = windowEvents && 'current' in windowEvents && windowEvents.current ? windowEvents.current.splice(0, windowEvents.current.length) : [];

    if (Object.keys(storedAnswer || {}).length === 0) {
      storeDispatch(
        saveTrialAnswer({
          identifier,
          answer,
          startTime,
          endTime,
          provenanceGraph,
          windowEvents: currentWindowEvents,
        }),
      );
      // Update database
      if (storageEngine) {
        storageEngine.saveAnswer(
          identifier,
          {
            answer,
            startTime,
            endTime,
            provenanceGraph,
            windowEvents: currentWindowEvents,
          },
        );
      }
      storeDispatch(setIframeAnswers([]));
    }

    let nextStep = currentStep + 1;

    // Traverse through the sequence to find the block the current component is in
    const blockForStep = findBlockForStep(sequence, currentStep);

    // If the current component is in a block that has a skip block
    const hasSkipBlock = blockForStep !== null && ((Object.hasOwn(blockForStep.currentBlock, 'skip') && blockForStep.currentBlock.skip !== undefined) || blockForStep.parentBlocks.length > 0);

    // Get the answers with the new answer added, since above is dispatching and async
    const answersWithNewAnswer = {
      ...answers,
      [identifier]: {
        answer, startTime, endTime, provenanceGraph, windowEvents: currentWindowEvents,
      },
    };

    // Check if the skip block should be triggered
    if (hasSkipBlock && answersWithNewAnswer && answersWithNewAnswer[identifier]) {
      const {
        currentBlock,
        firstIndex,
        lastIndex,
        parentBlocks,
      } = blockForStep;
      const skipCondition = [
        ...(currentBlock.skip ? currentBlock.skip.map((condition) => ({ ...condition, firstIndex, lastIndex })) : []),
        ...parentBlocks.flatMap((block) => (block.currentBlock.skip ? block.currentBlock.skip.map((condition) => ({ ...condition, firstIndex: block.firstIndex, lastIndex: block.lastIndex })) : [])) || [],
      ];

      // Loop over all conditions, use `.some()` to stop early if the condition is met
      skipCondition.some((condition) => {
        let conditionIsTriggered = false;

        const validationCandidates = Object.fromEntries(Object.entries(answersWithNewAnswer).filter(([key]) => {
          const componentIndex = parseInt(key.slice(key.lastIndexOf('_') + 1), 10);
          return componentIndex >= condition.firstIndex && componentIndex <= Math.min(condition.lastIndex, currentStep);
        })) as unknown as StoredAnswer;

        // Check if the condition is met
        if (condition.check === 'response') {
          // Slim down the validationCandidates to only include the skip condition's component
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const componentToCheck = Object.entries(validationCandidates).filter(([key]) => key.slice(0, key.lastIndexOf('_')) === condition.name).filter(([_], index) => index === 0);

          if (componentToCheck.length === 0) {
            throw new Error(`Could not find component ${condition.name} in the validationCandidates`);
          }

          if (componentToCheck[0].length !== 2) {
            throw new Error(`Component ${condition.name} has issues with its response object. It should have a length of 2, but it has a length of ${componentToCheck[0].length}`);
          }

          const responseObj = componentToCheck[0][1];
          const response = { ...responseObj.answer };

          if (response[condition.responseId] !== condition.value) {
            conditionIsTriggered = true;
          }
        } else if (condition.check === 'responses') {
          // Slim down the validationCandidates to only include the skip condition's component
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const componentsToCheck = Object.entries(validationCandidates).filter(([key]) => key.slice(0, key.lastIndexOf('_')) === condition.name);

          conditionIsTriggered = componentsToCheck.some(([componentId, responseObj]) => {
            if (!responseObj) {
              throw new Error(`Component ${condition.name} has issues with its response object.`);
            }

            const response = { ...responseObj.answer };

            // Find the matching component in the study config
            const foundConfigComponent = Object.entries(studyConfig.components).find(([configComponentId, configComponent]) => configComponentId === componentId.slice(0, componentId.lastIndexOf('_')));
            const foundConfigComponentConfig = foundConfigComponent ? foundConfigComponent[1] : null;

            if (!foundConfigComponentConfig) {
              throw new Error(`Component ${condition.name} could not be found in the study components.`);
            }

            if (!foundConfigComponentConfig.correctAnswer) {
              throw new Error(`Component ${condition.name} does not have a correct answer.`);
            }

            // Check that the response is matches the correct answer
            return !foundConfigComponentConfig.correctAnswer.every((correctAnswerEntry) => response[correctAnswerEntry.id] === correctAnswerEntry.answer);
          });
        } else if (condition.check === 'block') {
          // If we have less than numCorrect or numIncorrect, we can't check the condition
          if (Object.entries(validationCandidates).length < condition.value) {
            return false;
          }

          // Check the candidates and count the number of correct and incorrect answers
          const correctAnswers = Object.entries(validationCandidates).map(([componentName, responseObj]) => {
            const response = { ...responseObj.answer };

            // Find the matching component in the study config
            const foundConfigComponent = Object.entries(studyConfig.components).find(([configComponentId, configComponent]) => configComponentId === componentName.slice(0, componentName.lastIndexOf('_')));
            const foundConfigComponentConfig = foundConfigComponent ? foundConfigComponent[1] : null;

            if (!foundConfigComponentConfig) {
              throw new Error(`Component ${componentName} could not be found in the study components.`);
            }

            if (!foundConfigComponentConfig.correctAnswer) {
              throw new Error(`Component ${componentName} does not have a correct answer.`);
            }

            // Check that the responses match the correct answer
            return foundConfigComponentConfig.correctAnswer.every((correctAnswerEntry) => response[correctAnswerEntry.id] === correctAnswerEntry.answer);
          });
          const numCorrect = correctAnswers.filter((correct) => correct).length;
          const numIncorrect = correctAnswers.length - numCorrect;

          // Check if the number of correct and incorrect answers match the condition
          if ((condition.condition === 'numCorrect' && numCorrect === condition.value) || (condition.condition === 'numIncorrect' && numIncorrect === condition.value)) {
            conditionIsTriggered = true;
          }
        } else if (condition.check === 'repeatedComponent') {
          // Slim down the validationCandidates to only include the skip condition's component
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const componentsToCheck = Object.entries(validationCandidates).filter(([key]) => key.slice(0, key.lastIndexOf('_')) === condition.name);

          // If we have less than numCorrect or numIncorrect, we can't check the condition
          if (componentsToCheck.length < condition.value) {
            return false;
          }

          // Check the candidates and count the number of correct and incorrect answers
          const correctAnswers = componentsToCheck.map(([_, responseObj]) => {
            if (!responseObj) {
              throw new Error(`Component ${condition.name} has issues with its response object.`);
            }

            const response = { ...responseObj.answer };

            // Find the matching component in the study config
            const foundConfigComponent = Object.entries(studyConfig.components).find(([configComponentId, configComponent]) => configComponentId === condition.name);
            const foundConfigComponentConfig = foundConfigComponent ? foundConfigComponent[1] : null;

            if (!foundConfigComponentConfig) {
              throw new Error(`Component ${condition.name} could not be found in the study components.`);
            }

            if (!foundConfigComponentConfig.correctAnswer) {
              throw new Error(`Component ${condition.name} does not have a correct answer.`);
            }

            // Check that the responses match the correct answer
            return foundConfigComponentConfig.correctAnswer.every((correctAnswerEntry) => response[correctAnswerEntry.id] === correctAnswerEntry.answer);
          });

          const numCorrect = correctAnswers.filter((correct) => correct).length;
          const numIncorrect = correctAnswers.length - numCorrect;

          // Check if the number of correct and incorrect answers match the condition
          if ((condition.condition === 'numCorrect' && numCorrect === condition.value) || (condition.condition === 'numIncorrect' && numIncorrect === condition.value)) {
            conditionIsTriggered = true;
          }
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

    navigate(`/${studyId}/${nextStep}${window.location.search}`);
  }, [trialValidation, identifier, windowEvents, storedAnswer, currentStep, sequence, answers, startTime, navigate, studyId, storeDispatch, saveTrialAnswer, storageEngine, setIframeAnswers, studyConfig.components, participantSequence]);

  return {
    isNextDisabled,
    goToNextStep,
  };
}
