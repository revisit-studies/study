import {
  Box,
  Button,
  CloseButton,
  Flex,
  Tabs,
  Text,
  AppShell,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  IconBrandFirebase, IconBrandSupabase, IconDatabase, IconGraph, IconGraphOff, IconInfoCircle, IconSettingsShare, IconUserPlus,
} from '@tabler/icons-react';
import { useHref } from 'react-router';
import { StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import {
  useStoreActions, useStoreDispatch, useStoreSelector,
} from '../../store/store';
import { useStudyId } from '../../routes/utils';
import { getNewParticipant } from '../../utils/nextParticipant';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';

function InfoHover({ text }: { text: string }) {
  return (
    <Tooltip label={text} multiline w={200} style={{ whiteSpace: 'normal' }} withinPortal position="bottom">
      <IconInfoCircle size={16} style={{ marginBottom: -3, marginLeft: 4 }} />
    </Tooltip>
  );
}

export function AppAside() {
  const sequence = useStoreSelector((state) => state.sequence);
  const answers = useStoreSelector((state) => state.answers);
  const { toggleStudyBrowser } = useStoreActions();

  const studyConfig = useStudyConfig();
  const dispatch = useStoreDispatch();

  const studyId = useStudyId();
  const studyHref = useHref(`/${studyId}`);

  const { storageEngine } = useStorageEngine();

  const isAnalysis = useIsAnalysis();

  const [activeTab, setActiveTab] = useState<string | null>('participant');

  const nextParticipantDisabled = useMemo(() => activeTab === 'allTrials' || isAnalysis, [activeTab, isAnalysis]);

  const modes = useStoreSelector((state) => state.modes);

  return (
    <AppShell.Aside className="studyBrowser" data-testid="app-aside" p="0">
      <AppShell.Section
        p="sm"
        pb={0}
      >
        <Flex direction="row" justify="space-between">
          <Text size="md" fw={700} pt={3}>
            Study Browser
          </Text>
          <Tooltip label="Go to the sequence of the next participant in the experiment. Sequences can be different between participants due to randomization, etc." w={280} multiline disabled={nextParticipantDisabled}>
            <Button
              variant="light"
              leftSection={<IconUserPlus size={14} />}
              onClick={() => getNewParticipant(storageEngine, studyHref)}
              size="xs"
              disabled={nextParticipantDisabled}
            >
              Next Participant
            </Button>
          </Tooltip>
          {isAnalysis ? (
            <Tooltip
              label="The study browser cannot be closed in replay mode"
              withinPortal
            >
              <CloseButton
                onClick={() => dispatch(toggleStudyBrowser())}
                mt={1}
                disabled={isAnalysis}
              />
            </Tooltip>
          ) : (
            <CloseButton
              onClick={() => dispatch(toggleStudyBrowser())}
              mt={1}
              disabled={isAnalysis}
            />
          )}
        </Flex>
        <Flex direction="row" justify="space-between" align="center" mt="xs" opacity={0.7}>
          <Text size="sm">
            Study Status:
            {' '}
            {modes?.dataCollectionEnabled ? 'Collecting Data' : 'Data Collection Disabled'}
          </Text>
          <Flex gap="sm" align="center">
            <Tooltip label="Edit Study Settings" withinPortal position="bottom">
              <ActionIcon
                variant="white"
                aria-label="Edit Study Modes"
                component="a"
                href={useHref(`/analysis/stats/${studyId}/manage`)}
                p={0}
              >
                <IconSettingsShare style={{ width: '70%', height: '70%' }} stroke={1.5} size={16} />
              </ActionIcon>
            </Tooltip>
            {modes?.dataSharingEnabled
              ? <Tooltip label="Data sharing enabled" multiline w={200} style={{ whiteSpace: 'normal' }} withinPortal position="bottom"><IconGraph size={16} color="green" /></Tooltip>
              : <Tooltip label="Data sharing disabled" multiline w={200} style={{ whiteSpace: 'normal' }} withinPortal position="bottom"><IconGraphOff size={16} color="red" /></Tooltip>}
            {storageEngine?.getEngine() === 'localStorage'
              ? <Tooltip label="Local storage enabled" withinPortal position="bottom"><IconDatabase size={16} color="green" /></Tooltip>
              : storageEngine?.getEngine() === 'firebase'
                ? <Tooltip label="Firebase enabled" withinPortal position="bottom"><IconBrandFirebase size={16} color="green" /></Tooltip>
                : storageEngine?.getEngine() === 'supabase'
                  ? <Tooltip label="Supabase enabled" withinPortal position="bottom"><IconBrandSupabase size={16} color="green" /></Tooltip>
                  : <Tooltip label="Unknown storage engine enabled" withinPortal position="bottom"><IconDatabase size={16} color="red" /></Tooltip>}
          </Flex>
        </Flex>
      </AppShell.Section>

      <AppShell.Section
        grow
        p="xs"
        pt={4}
        style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          keepMounted={false}
          style={{
            display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden',
          }}
        >
          <Box style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'white',
            zIndex: 1,
            flexShrink: 0,
          }}
          >
            <Tabs.List grow>
              <Tabs.Tab value="participant">
                Participant View
                <InfoHover text="The Participants View shows items just as a participants would see them, considering randomization, omissions, etc. You can navigate between multiple participants using the next participant button." />
              </Tabs.Tab>
              <Tabs.Tab value="allTrials" disabled={isAnalysis} p="xs">
                Browse Components
                <InfoHover text="Browse Components allows you to view all the components that are defined in your study." />
              </Tabs.Tab>
            </Tabs.List>
          </Box>

          <Tabs.Panel value="participant" style={{ flex: 1, overflow: 'hidden' }}>
            <StepsPanel participantSequence={sequence} participantAnswers={answers} studyConfig={studyConfig} />
          </Tabs.Panel>
          <Tabs.Panel value="allTrials" style={{ flex: 1, overflow: 'hidden' }}>
            <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />
          </Tabs.Panel>
        </Tabs>
      </AppShell.Section>
    </AppShell.Aside>
  );
}
