import { useSearchParams } from 'react-router';
import { useIsAnalysis } from './useIsAnalysis';

export function startDesignerPreview(studyId: string) {
  sessionStorage.setItem(`revisit-preview:${studyId}`, 'true');
}

/** An explicit Preview entry and its per-tab session marker are both required. */
export function useDesignerPreview(studyId: string) {
  const [params] = useSearchParams();
  const isAnalysis = useIsAnalysis();
  return !isAnalysis && params.get('preview') === 'true'
    && sessionStorage.getItem(`revisit-preview:${studyId}`) === 'true';
}
