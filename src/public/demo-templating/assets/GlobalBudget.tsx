import { useEffect } from 'react';
import { Button, Stack, Text, Title } from '@mantine/core';
import type { StimulusParams } from '../../../store/types';
import { useStudyState } from '../../../store/hooks/useStudyState';

export default function GlobalBudget({ globalVariables, registerGlobalStoreUpdater, setAnswer }: StimulusParams<unknown>) {
  const [spend, setSpend] = useStudyState({ responseId: 'spend', initialState: 0 });
  useEffect(() => { setAnswer({ status: true, answers: { spend } }); }, [setAnswer, spend]);
  useEffect(() => registerGlobalStoreUpdater(({ store }) => ({ budget: Number(store.budget) - spend })), [registerGlobalStoreUpdater, spend]);
  return (
    <Stack>
      <Title order={2}>React global variables</Title>
      <Text>React content budget: {globalVariables.budget}</Text>
      <Text>Participant label: {globalVariables.participantLabel}</Text>
      <Text>Read the globalVariables prop, then render globalVariables.budget in JSX.</Text>
      <Button onClick={() => setSpend(15)} disabled={Number(globalVariables.budget) < 15}>Spend 15 in React</Button>
      <Text>React selected spending: {spend}</Text>
    </Stack>
  );
}
