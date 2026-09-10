import { ReactNode } from 'react';
import { useParams } from 'react-router';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { useFlatSequence } from '../store/store';
import { parseStepIndex } from '../utils/encryptDecryptIndex';
import { findFuncBlock } from '../utils/getSequenceFlatMap';

export function StudyRouteGuard({ children }: { children: ReactNode }) {
  const { index, funcIndex } = useParams();
  const studyConfig = useStudyConfig();
  const flatSequence = useFlatSequence();

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
      isValid = parseStepIndex(funcIndex) !== null
        && Boolean(findFuncBlock(flatSequence[step], studyConfig.sequence));
    }
  }

  return isValid ? children : <ResourceNotFound email={studyConfig.uiConfig.contactEmail} />;
}
