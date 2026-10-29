import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import { Registry } from '@trrack/core';
import type { StimulusParams } from '../../../store/types';
import { useStudyState } from '../../../store/hooks/useStudyState';
import { useNextStep } from '../../../store/hooks/useNextStep';

type PurchaseState = { cost: number | null; budgetAtEntry: number; zoom: number };
type Parameters = { faultControls?: boolean; delayMs?: number };

export default function Purchase({
  parameters = {}, setAnswer, useTrrack, provenanceState, store, registerGlobalStoreUpdater,
}: StimulusParams<Parameters, PurchaseState>) {
  const [initialCost] = useStudyState<number | null>({ responseId: 'selectedCost', initialState: null });
  const { registry, select, zoomIn } = useMemo(() => {
    const reg = Registry.create();
    return {
      registry: reg,
      select: reg.register('select-item', (state: PurchaseState, cost: number) => ({ ...state, cost })),
      zoomIn: reg.register('zoom-in', (state: PurchaseState, amount: number) => ({ ...state, zoom: state.zoom + amount })),
    };
  }, []);
  const trrack = useTrrack({ registry, initialState: { cost: initialCost, budgetAtEntry: Number(store.budget), zoom: 1 } });
  const state = useStudyState({ trrack });
  const displayed = provenanceState ?? state;
  const [rejectUpdate, setRejectUpdate] = useState(false);
  const { goToNextStep } = useNextStep();

  useEffect(() => {
    setAnswer({ status: state.cost !== null, answers: { selectedCost: state.cost } });
  }, [state.cost, setAnswer]);

  useEffect(() => registerGlobalStoreUpdater(async ({ store: entryStore }) => {
    if (parameters.delayMs) await new Promise<void>((resolve) => { window.setTimeout(resolve, parameters.delayMs); });
    if (rejectUpdate) throw new Error('The purchase could not be calculated. Turn off Reject update and retry.');
    if (state.cost === null) throw new Error('Choose an item before continuing.');
    return { budget: Number(entryStore.budget) - state.cost };
  }), [parameters.delayMs, registerGlobalStoreUpdater, rejectUpdate, state.cost]);

  return (
    <Stack>
      <Text>React entry budget: {String(store.budget)}</Text>
      <Text>Tracked entry budget: {displayed.budgetAtEntry}</Text>
      <Group aria-label="Purchase choices">
        {[0, 5, 10, 15, 20].map((cost) => (
          <Button
            key={cost}
            aria-pressed={displayed.cost === cost}
            variant={displayed.cost === cost ? 'filled' : 'outline'}
            onClick={() => trrack.apply('Select item', select(cost))}
          >
            Spend {cost}
          </Button>
        ))}
      </Group>
      <Text>Selected cost: {displayed.cost ?? 'none'}</Text>
      <Text>Tracked zoom: {displayed.zoom}</Text>
      <Button onClick={() => trrack.apply('Zoom in', zoomIn(1))}>Zoom in</Button>
      {parameters.faultControls && (
        <>
          <Checkbox label="Reject update" checked={rejectUpdate} onChange={(event) => setRejectUpdate(event.currentTarget.checked)} />
          <Button onClick={() => goToNextStep()}>Submit purchase</Button>
        </>
      )}
    </Stack>
  );
}
