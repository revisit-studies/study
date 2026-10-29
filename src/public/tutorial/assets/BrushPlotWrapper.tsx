import { useGlobalStore, useGlobalStoreUpdaterRegistration } from '../../../store/hooks/useGlobalStore';
import { BrushParams, BrushState } from '../../example-brush-interactions/assets/types';
import { BrushPlot } from '../../example-brush-interactions/assets/BrushPlot';
import { ParticipantData } from '../../../storage/types';
import type { UseTrrack } from '../../../store/types';

export default function BrushPlotWrapper({
  state, params, answers, onStateChange, useTrrack,
}: { state?: BrushState, params: BrushParams, answers: ParticipantData['answers'], onStateChange?: (b: BrushState) => void, useTrrack: UseTrrack }) {
  const store = useGlobalStore();
  const registerGlobalStoreUpdater = useGlobalStoreUpdaterRegistration();
  return <BrushPlot store={store} registerGlobalStoreUpdater={registerGlobalStoreUpdater} parameters={params} setAnswer={() => null} provenanceState={state ? { all: state } as any : undefined} updateState={onStateChange || (() => null)} answers={answers} useTrrack={useTrrack} />;
}
