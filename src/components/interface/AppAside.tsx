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
import React, { useMemo, useState } from 'react';
import { IconInfoCircle, IconUserPlus } from '@tabler/icons-react';
import { useHref } from 'react-router-dom';
import { ComponentBlockWithOrderPath, StepsPanel } from './StepsPanel';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import {
  useStoreActions, useStoreDispatch, useStoreSelector,
} from '../../store/store';
import { useStudyId } from '../../routes/utils';
import { deepCopy } from '../../utils/deepCopy';
import { getNewParticipant } from '../../utils/nextParticipant';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { addPathToComponentBlock } from '../../utils/getSequenceFlatMap';

// eslint-disable-next-line react/display-name
function InfoHover({ text }: { text: string }) {
  return (
    <Tooltip label={text} multiline w={200} style={{ whiteSpace: 'normal' }} withinPortal position="bottom">
      <IconInfoCircle size={16} style={{ marginBottom: -3, marginLeft: 4 }} />
    </Tooltip>
  );
}

export default function AppAside() {
  const { sequence, metadata } = useStoreSelector((state) => state);
  const { toggleStudyBrowser } = useStoreActions();

  const studyConfig = useStudyConfig();
  const dispatch = useStoreDispatch();

  const studyId = useStudyId();
  const studyHref = useHref(`/${studyId}`);

  const { storageEngine } = useStorageEngine();

  const fullOrder = useMemo(() => {
    let r = deepCopy(studyConfig.sequence) as ComponentBlockWithOrderPath;
    r = addPathToComponentBlock(r, 'root') as ComponentBlockWithOrderPath;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  const [activeTab, setActiveTab] = useState<string | null>('participant');

  return (
    <AppShell.Aside p="0">
      <AppShell.Section>
        <Flex direction="row" p="sm" justify="space-between" pb="xs">
          <Text size="md" fw={700} pt={3}>
            Study Browser
          </Text>
          <Button
            variant="light"
            leftSection={<IconUserPlus size={14} />}
            onClick={() => getNewParticipant(storageEngine, studyConfig, metadata, studyHref)}
            size="xs"
            disabled={activeTab === 'allTrials'}
          >
            Next Participant
          </Button>
          <CloseButton
            onClick={() => dispatch(toggleStudyBrowser())}
            mt={1}
          />
        </Flex>
      </AppShell.Section>

      <AppShell.Section grow component={ScrollArea} p="xs" pt={0}>
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
              <Tabs.Tab value="allTrials">
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
