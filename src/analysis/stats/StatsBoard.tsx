import {
  Badge,
  Box,
  Container,
  Group, LoadingOverlay, MultiSelect,
  Paper,
  SelectItem,
  Stack, Tabs,
  Text,
  Title,
} from '@mantine/core';
import React, { useEffect, useState } from 'react';
import {
  IconSquareCheck, IconProgressBolt, IconArrowUp,
} from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { ParticipantData } from '../../storage/types';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { GlobalConfig, StudyConfig } from '../../parser/types';
import { getStudyConfig } from '../../utils/fetchConfig';
import { isStudyCompleted } from '../utils';
import StatsVis from './StatsVis';

export function StatsBoard(props: {globalConfig : GlobalConfig}) {
  const { globalConfig } = props;
  // const studyIds = globalConfig.configsList;
  const [config, setConfig] = useState<StudyConfig>();
  const [activeExp, setActiveExp] = useState<string | null>(null);
  const [expData, setExpData] = useState<ParticipantData[]>([]);
  const [completed, setCompleted] = useState<ParticipantData[]>([]);
  const [inprogress, setInprogress] = useState<ParticipantData[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownData, setDropdownData] = useState<SelectItem[]>([]);
  const [activeParticipants, setActiveParticipants] = useState<string[]>([]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (activeParticipants.includes('All')) {
      setDropdownData([{ label: 'All', value: 'All' }, ...completed.map((d) => ({ value: d.participantId, label: d.participantId, disabled: true }))]);
    } else setDropdownData([{ label: 'All', value: 'All' }, ...completed.map((d) => ({ value: d.participantId, label: d.participantId }))]);
  }, [completed, activeParticipants]);

  useEffect(() => {
    const updateParams = async () => {
      const exp = searchParams.get('exp');
      if (exp) {
        setActiveExp(exp);
        const cf = await getStudyConfig(exp, globalConfig);
        if (cf) setConfig(cf);
      }
    };
    updateParams();
  }, [searchParams]);

  const reSetSelection = () => {
    setActiveParticipants([]);
  };

  useEffect(() => {
    const getData = async () => {
      setLoading(true);
      reSetSelection();
      const fetchData = async () => {
        if (activeExp) {
          const storageEngine = new FirebaseStorageEngine();
          const cf = await getStudyConfig(activeExp, globalConfig);
          if (!cf || !storageEngine) return;
          await storageEngine.connect();
          await storageEngine.initializeStudyDb(activeExp, cf);
          const data = (await storageEngine.getAllParticipantsData());
          setExpData(data);
          setCompleted(data.filter((d) => isStudyCompleted(d)));

          setInprogress(data.filter((d) => !isStudyCompleted(d)));
        }
        setLoading(false);
      };
      await fetchData();
    };
    getData();
  }, [activeExp]);

  return (
    <Container miw={800}>
      {(activeExp && expData) ? (
        <Box
          mt={10}
          p={10}
        >
          <Paper p={10} sx={{ boxShadow: '1px 2px 2px 3px lightgrey;', borderRadius: '5px' }}>
            <Group>
              <Stack spacing="xs" mb={10}>
                <Title order={3}>
                  {' '}
                  {activeExp}
                </Title>
                <Text>
                  Total Participants:
                  {expData.length}
                </Text>
              </Stack>
              <Tabs defaultValue="completed" orientation="vertical">
                <Tabs.List>
                  <Tabs.Tab
                    rightSection={(
                      <Badge
                        color="green"
                        sx={{ width: 16, height: 16, pointerEvents: 'none' }}
                        variant="filled"
                        size="xs"
                        p={0}
                      >
                        {completed.length}
                      </Badge>
                            )}
                    value="completed"
                    icon={(
                      <IconSquareCheck
                        color="green"
                        size={12}
                      />
                    )}
                  >
                    Completed
                  </Tabs.Tab>

                  <Tabs.Tab
                    rightSection={(
                      <Badge
                        color="yellow"
                        sx={{ width: 16, height: 16, pointerEvents: 'none' }}
                        variant="filled"
                        size="xs"
                        p={0}
                      >
                        {inprogress.length}
                      </Badge>
                            )}
                    value="inprogress"
                    icon={(
                      <IconProgressBolt
                        color="orange"
                        size={12}
                      />
                    )}
                  >
                    In Progress
                  </Tabs.Tab>

                </Tabs.List>
                <Tabs.Panel value="completed" pt="xs">
                  <Paper p={10}>
                    <MultiSelect
                      maxDropdownHeight={400}
                      clearable
                      miw={300}
                      data={dropdownData}
                      onChange={setActiveParticipants}
                    />

                  </Paper>
                </Tabs.Panel>

                <Tabs.Panel value="inprogress" pt="xs">
                  For In progress users, a seperate view.
                </Tabs.Panel>

              </Tabs>
            </Group>

          </Paper>

        </Box>
      ) : (
        <Box ml="50%">
          <Box ml={200}>
            <IconArrowUp size={30} display="block" />
          </Box>
          <Title>Please select an experiment</Title>
        </Box>
      )}
      <LoadingOverlay visible={loading} zIndex={1000} overlayBlur={2} />

      {config && (activeParticipants.length > 1 || activeParticipants.includes('All')) && (
      <StatsVis
        config={config}
        data={
        activeParticipants.includes('All')
          ? completed
          : completed.filter((d) => activeParticipants.includes(d.participantId))
}
      />
      )}
      {activeParticipants.length === 0 && (
      <Title ml={200} order={4}>
        <IconArrowUp size={30} />
        Select 1 participant to check individual detials, select 2+ participants to check aggregated results
      </Title>
      )}

    </Container>

  );
}
