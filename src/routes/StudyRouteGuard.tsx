import { ReactNode } from 'react';
import { useParams } from 'react-router';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { useFlatSequence, useStoreSelector } from '../store/store';
import { parseStepIndex } from '../utils/encryptDecryptIndex';
import { findFuncBlock } from '../utils/getSequenceFlatMap';

export function StudyRouteGuard({ children }: { children: ReactNode }) {
  const { index, funcIndex } = useParams();
  const studyConfig = useStudyConfig();
  const flatSequence = useFlatSequence();
  const answers = useStoreSelector((state) => state.answers);

  // The study root redirects to the first step.
  let isValid = index === undefined;
  if (index?.startsWith('reviewer-')) {
    // Reviewer URLs reference a configured component by name.
    isValid = Object.hasOwn(studyConfig.components, index.slice('reviewer-'.length)) && funcIndex === undefined;
  } else if (index === '__trainingFailed' || index === '__timedOut') {
    // These terminal screens do not use numeric step indices.
    isValid = funcIndex === undefined;
  } else if (index !== undefined) {
    // Participant URLs must resolve to a step in their assigned sequence.
    const step = parseStepIndex(index);
    isValid = step !== null && step < flatSequence.length;
    if (isValid && step !== null && funcIndex !== undefined) {
      // Only dynamic blocks accept an additional iteration index.
      const iteration = parseStepIndex(funcIndex);
      isValid = iteration !== null
        && Boolean(findFuncBlock(flatSequence[step], studyConfig.sequence));
      if (isValid && iteration !== null) {
        // Use answer records because funcSequence starts empty after a page reload.
        const existingIterations = new Set<number>();
        Object.entries(answers).forEach(([identifier, answer]) => {
          const ordinal = Number(identifier.slice(identifier.lastIndexOf('_') + 1));
          // Count only records for this block and step with a known component.
          if (Number.isSafeInteger(ordinal) && ordinal >= 0
            && Object.hasOwn(studyConfig.components, answer.componentName)
            && identifier === `${flatSequence[step]}_${step}_${answer.componentName}_${ordinal}`) {
            existingIterations.add(ordinal);
          }
        });

        // Find the first missing iteration: [0, 1] allows 2; [0, 2] allows 1.
        let nextIteration = 0;
        while (existingIterations.has(nextIteration)) {
          nextIteration += 1;
        }
        // Allow revisiting an existing iteration or creating the next one, without skipping ahead.
        isValid = existingIterations.has(iteration) || iteration === nextIteration;
      }
    }
  }

  return isValid ? children : <ResourceNotFound email={studyConfig.uiConfig.contactEmail} />;
}
