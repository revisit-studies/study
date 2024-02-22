import { useParams } from 'react-router-dom';

export function useStudyId(): string {
  const { studyId } = useParams();

  return `${studyId}`;
}

export function useCurrentStep(): number {
  const { index } = useParams();

  return parseInt(index || '0', 10);
}
