import {
  Box,
  Button,
  CloseButton,
  Flex,
  ScrollArea,
  Tabs,
  Text,
  AppShell,
  Tooltip,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  IconDatabase, IconFlame, IconGraph, IconGraphOff, IconInfoCircle, IconUserPlus,
} from '@tabler/icons-react';
import { useHref } from 'react-router';
import { ComponentBlockWithOrderPath, StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import {
  useStoreActions, useStoreDispatch, useStoreSelector,
} from '../../store/store';
import { useStudyId } from '../../routes/utils';
import { getNewParticipant } from '../../utils/nextParticipant';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { addPathToComponentBlock } from '../../utils/getSequenceFlatMap';
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
  const { toggleStudyBrowser } = useStoreActions();

  const studyConfig = useStudyConfig();
  const dispatch = useStoreDispatch();

  const studyId = useStudyId();
  const studyHref = useHref(`/${studyId}`);

  const { storageEngine } = useStorageEngine();

  const isAnalysis = useIsAnalysis();

  const fullOrder = useMemo(() => {
    let r = structuredClone(studyConfig.sequence) as ComponentBlockWithOrderPath;
    r = addPathToComponentBlock(r, 'root') as ComponentBlockWithOrderPath;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  const [activeTab, setActiveTab] = useState<string | null>('participant');

  const nextParticipantDisabled = useMemo(() => activeTab === 'allTrials' || isAnalysis, [activeTab, isAnalysis]);

  const modes = useStoreSelector((state) => state.modes);

  return (
    <AppShell.Aside className="studyBrowser" p="0">
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
        <Flex direction="row" justify="space-between" mt="xs" opacity={0.7}>
          <Text size="sm">
            Study Status:
            {' '}
            {modes?.dataCollectionEnabled ? 'Collecting Data' : 'Data Collection Disabled'}
          </Text>
          <Flex gap="sm">
            {modes?.analyticsInterfacePubliclyAccessible
              ? <Tooltip label="Analytics interface publicly accessible" multiline w={200} style={{ whiteSpace: 'normal' }} withinPortal position="bottom"><IconGraph size={16} color="green" /></Tooltip>
              : <Tooltip label="Analytics interface not publicly accessible" multiline w={200} style={{ whiteSpace: 'normal' }} withinPortal position="bottom"><IconGraphOff size={16} color="red" /></Tooltip>}
            {storageEngine?.getEngine() === 'localStorage'
              ? <Tooltip label="Local storage enabled" withinPortal position="bottom"><IconDatabase size={16} color="green" /></Tooltip>
              : <Tooltip label="Firebase enabled" withinPortal position="bottom"><IconFlame size={16} color="green" /></Tooltip>}
          </Flex>
        </Flex>
      </AppShell.Section>

      <AppShell.Section
        grow
        component={ScrollArea}
        p="xs"
        pt={8}
      >
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Box style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'white',
            zIndex: 1,
          }}
          >
            <Tabs.List grow>
              <Tabs.Tab value="participant">
                Participant View
                <InfoHover text="The Participants View shows items just as a participants would see them, considering randomization, omissions, etc. You can navigate between multiple participants using the next participant button." />
              </Tabs.Tab>
              <Tabs.Tab value="allTrials" disabled={isAnalysis}>
                All Trials View
                <InfoHover text="The All Trials View shows all items in the order defined in the config." />
              </Tabs.Tab>
            </Tabs.List>
          </Box>

          <Tabs.Panel value="participant">
            <StepsPanel configSequence={fullOrder} participantSequence={sequence} fullSequence={sequence} participantView studyConfig={studyConfig} />
          </Tabs.Panel>
          <Tabs.Panel value="allTrials">
            <StepsPanel configSequence={fullOrder} participantSequence={sequence} fullSequence={sequence} participantView={false} studyConfig={studyConfig} />
          </Tabs.Panel>
        </Tabs>
      </AppShell.Section>
    </AppShell.Aside>
  );
}
