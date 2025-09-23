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
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useHref } from 'react-router';
import { useCurrentComponent, useCurrentStep, useStudyId } from '../../routes/utils';
import {
  useStoreDispatch, useStoreSelector, useStoreActions, useFlatSequence,
} from '../../store/store';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { PREFIX } from '../../utils/Prefix';
import { getNewParticipant } from '../../utils/nextParticipant';
import { RecordingAudioWaveform } from './RecordingAudioWaveform';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';

export function AppHeader({
  studyNavigatorEnabled, dataCollectionEnabled, screenRecording, screenWithAudioRecording,
}: { studyNavigatorEnabled: boolean; dataCollectionEnabled: boolean, screenRecording: boolean, screenWithAudioRecording: boolean }) {
  const studyConfig = useStoreSelector((state) => state.config);

  const answers = useStoreSelector((state) => state.answers);
  const flatSequence = useFlatSequence();
  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText, toggleStudyBrowser, incrementHelpCounter } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const currentComponent = useCurrentComponent();
  const componentConfig = useMemo(() => studyComponentToIndividualComponent(studyConfig.components[currentComponent] || {}, studyConfig), [currentComponent, studyConfig]);

  const currentStep = useCurrentStep();

  const progressPercent = useMemo(() => {
    const answered = Object.values(answers).filter((answer) => answer.endTime > -1).length;
    const total = flatSequence.map((step, idx) => {
      // If the step is a component, it adds 1 to the total
      if (studyConfig.components[step]) {
        return 1;
      }
      // If we're in a dynamic block, guess a maximum of 30 steps
      if (typeof currentStep === 'number' && currentStep <= idx && step !== 'end') {
        return 55;
      }
      // Otherwise, count the number of answers for this dynamic block
      return Object.entries(answers).filter(([key, _]) => key.includes(`${step}_`)).length;
    }).reduce((a, b) => a + b, 0);

    return (answered / total) * 100;
  }, [answers, currentStep, flatSequence, studyConfig.components]);

  const [menuOpened, setMenuOpened] = useState(false);

  const logoPath = studyConfig?.uiConfig.logoPath;
  const withProgressBar = useMemo(() => componentConfig.withProgressBar ?? studyConfig.uiConfig.withProgressBar, [componentConfig, studyConfig]);
  const showTitle = useMemo(() => componentConfig.showTitle ?? studyConfig.uiConfig.showTitle ?? true, [componentConfig, studyConfig]);

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
    <AppShell.Header className="header" p="md">
      <Grid mt={-7} align="center">
        <Grid.Col span={4}>
          <Flex align="center">
            <Image w={40} src={`${PREFIX}${logoPath}`} alt="Study Logo" className="logoImage" />
            <Space w="md" />
            {showTitle ? (
              <Title
                ref={titleRef}
                order={4}
                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                title={isTruncated ? studyConfig?.studyMetadata.title : undefined}
                className="studyTitle"
              >
                {studyConfig?.studyMetadata.title}
              </Title>
            ) : null }
          </Flex>
        </Grid.Col>

        <Grid.Col span={4}>
          {withProgressBar && (
            <Progress radius="md" size="lg" value={progressPercent} className="progressBar" />
          )}
        </Grid.Col>

        <Grid.Col span={4}>
          <Group wrap="nowrap" justify="right">
            {(isRecording || screenRecording) && (() => {
              const recordingAudio = isRecording || (screenWithAudioRecording && screenRecording);
              const recordingScreen = screenRecording;

              return (
                <Group ml="xl" gap={20} wrap="nowrap">
                  <Text c="red">
                    Recording
                    {recordingScreen && ' screen'}
                    {recordingScreen && recordingAudio && ' and'}
                    {recordingAudio && ' audio'}
                  </Text>
                  {recordingAudio && <RecordingAudioWaveform />}
                </Group>
              );
            })()}
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
                    onClick={() => getNewParticipant(storageEngine, studyHref)}
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
