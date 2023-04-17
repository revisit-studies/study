import { useCallback, useContext } from 'react';
import { TrialProvenanceContext } from '../../../store/trialProvenance';

export function useHoverInteraction(id: string) {
  const { actions } = useContext(TrialProvenanceContext);

  const handleMouseEnter = useCallback(
    (d: { name: string }) => {
      actions.saveInteraction('Hover start', {
        id,
        action: 'mouseEnter',
        objectID: d.name,
      });
    },
    [id]
  );

  const handleMouseLeave = useCallback(
    (d: { name: string }) => {
      actions.saveInteraction('Hover Complete', {
        id,
        action: 'mouseLeave',
        objectID: d.name,
      });
    },
    [id]
  );

  return { handleMouseEnter, handleMouseLeave };
}
