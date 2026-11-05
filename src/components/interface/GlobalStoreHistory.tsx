import { NativeSelect, Paper, Text } from '@mantine/core';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useStoreSelector } from '../../store/store';
import { getGlobalStoreHistory } from '../../store/globalStoreHistory';
import { getActiveGlobalStoreSubmissions } from '../../store/globalStoreProvenance';
import { useCurrentIdentifier, useStudyId } from '../../routes/utils';
import { parseTrialOrder } from '../../utils/parseTrialOrder';
import { encryptIndex } from '../../utils/encryptDecryptIndex';

export function GlobalStoreHistory() {
  const graph = useStoreSelector((state) => state.globalStoreGraph);
  const identifier = useCurrentIdentifier();
  const studyId = useStudyId();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const history = useMemo(() => (graph ? getGlobalStoreHistory(graph) : []), [graph]);
  const selected = graph && getActiveGlobalStoreSubmissions(graph).find((entry) => entry.submission.answer.identifier === identifier)?.nodeId;
  const entry = history.find((candidate) => candidate.nodeId === selected);
  if (!graph || history.length === 0) return null;
  return (
    <Paper withBorder p="sm" mb="sm">
      <NativeSelect
        label="Submission history"
        value={selected ?? ''}
        data={[{ value: '', label: 'Choose a recorded submission' }, ...history.map((candidate, index) => ({
          value: candidate.nodeId,
          label: `${index + 1}. ${candidate.submission.answer.identifier}${candidate.active ? ' (selected path)' : ' (retained history)'}`,
        }))]}
        onChange={(event) => {
          const candidate = history.find((item) => item.nodeId === event.currentTarget.value);
          if (!candidate) return;
          const { step, funcIndex } = parseTrialOrder(candidate.submission.answer.trialOrder);
          if (step === null) return;
          const query = new URLSearchParams(searchParams);
          query.set('globalStoreNode', candidate.nodeId);
          navigate(`/${studyId}/${encryptIndex(step)}${funcIndex !== null ? `/${encryptIndex(funcIndex)}` : ''}?${query}`);
        }}
      />
      {entry && (
      <Text size="sm">
        Store before:
        {JSON.stringify(entry.before)}
        ; after:
        {JSON.stringify(entry.after)}
      </Text>
      )}
    </Paper>
  );
}
