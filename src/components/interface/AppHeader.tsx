import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Flex,
  Grid,
  Group,
  Image,
  Menu,
  Progress,
  Space,
  Title,
  Tooltip,
  Text,
} from '@mantine/core';
import {
  IconChartHistogram,
  IconDotsVertical,
  IconMail,
  IconSchema,
  IconUserPlus,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useHref } from 'react-router-dom';
import { useCurrentComponent, useCurrentStep, useStudyId } from '../../routes/utils';
import {
  useStoreDispatch, useStoreSelector, useStoreActions, useFlatSequence,
} from '../../store/store';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { PREFIX } from '../../utils/Prefix';
import { getNewParticipant } from '../../utils/nextParticipant';
import RecordingAudioWaveform from './RecordingAudioWaveform';

export default function AppHeader({ studyNavigatorEnabled, dataCollectionEnabled }: { studyNavigatorEnabled: boolean; dataCollectionEnabled: boolean }) {
  const studyConfig = useStoreSelector((state) => state.config);
  const metadata = useStoreSelector((state) => state.metadata);

  const flatSequence = useFlatSequence();
  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText, toggleStudyBrowser, incrementHelpCounter } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const currentComponent = useCurrentComponent();

  const currentStep = useCurrentStep();

  const progressBarMax = flatSequence.length - 1;
  const progressPercent = typeof currentStep === 'number' ? (currentStep / progressBarMax) * 100 : 0;

  const [menuOpened, setMenuOpened] = useState(false);

  const logoPath = studyConfig?.uiConfig.logoPath;
  const withProgressBar = studyConfig?.uiConfig.withProgressBar;

  const studyId = useStudyId();
  const studyHref = useHref(`/${studyId}`);

  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const isRecording = useStoreSelector((store) => store.isRecording);

  useEffect(() => {
    const element = titleRef.current;
    if (element) {
      setIsTruncated(element.scrollWidth > element.offsetWidth);
    }
  }, [studyConfig]);

  return (
    <AppShell.Header p="md">
      <Grid mt={-7} align="center">
        <Grid.Col span={4}>
          <Flex align="center">
            <Image w={40} src={`${PREFIX}${logoPath}`} alt="Study Logo" />
            <Space w="md" />
            <Title
              ref={titleRef}
              order={4}
              style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              title={isTruncated ? studyConfig?.studyMetadata.title : undefined}
            >
              {studyConfig?.studyMetadata.title}
            </Title>
          </Flex>
        </Grid.Col>

        <Grid.Col span={4}>
          {withProgressBar && (
            <Progress radius="md" size="lg" value={progressPercent} />
          )}
        </Grid.Col>

        <Grid.Col span={4}>
          <Group wrap="nowrap" justify="right">
            {isRecording ? (
              <Group ml="xl" gap={20} wrap="nowrap">
                <Text color="red">Recording audio</Text>
                <RecordingAudioWaveform />
              </Group>
            ) : null}
            {!dataCollectionEnabled && <Tooltip multiline withArrow arrowSize={6} w={300} label="This is a demo version of the study, we’re not collecting any data."><Badge size="lg" color="orange">Demo Mode</Badge></Tooltip>}
            {studyConfig?.uiConfig.helpTextPath !== undefined && (
              <Button
                variant="outline"
                onClick={() => { storeDispatch(toggleShowHelpText()); storeDispatch(incrementHelpCounter({ identifier: `${currentComponent}_${currentStep}` })); }}
              >
                Help
              </Button>
            )}

            <Menu
              shadow="md"
              width={200}
              withinPortal
              opened={menuOpened}
              onChange={setMenuOpened}
            >
              <Menu.Target>
                <ActionIcon size="lg" className="studyBrowserMenuDropdown" variant="subtle" color="gray">
                  <IconDotsVertical />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {studyNavigatorEnabled && (
                  <Menu.Item
                    leftSection={<IconSchema size={14} />}
                    onClick={() => storeDispatch(toggleStudyBrowser())}
                  >
                    Study Browser
                  </Menu.Item>
                )}
                <Menu.Item
                  component="a"
                  href={
                      studyConfig !== null
                        ? `mailto:${studyConfig.uiConfig.contactEmail}`
                        : undefined
                    }
                  leftSection={<IconMail size={14} />}
                >
                  Contact
                </Menu.Item>
                {studyNavigatorEnabled && (
                  <Menu.Item
                    leftSection={<IconUserPlus size={14} />}
                    onClick={() => getNewParticipant(storageEngine, studyConfig, metadata, studyHref)}
                  >
                    Next Participant
                  </Menu.Item>
                )}
                {studyNavigatorEnabled && (
                  <Menu.Item
                    leftSection={<IconChartHistogram size={14} />}
                    component="a"
                    href={`${PREFIX}analysis/stats/${studyId}`}
                  >
                    Analyze & Manage
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Grid.Col>
      </Grid>
    </AppShell.Header>
  );
}
