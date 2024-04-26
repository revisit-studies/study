import {
  ActionIcon,
  Button,
  Flex,
  Grid,
  Header,
  Image,
  Menu,
  Progress,
  Space,
  Title,
} from '@mantine/core';
import {
  IconDotsVertical,
  IconMail,
  IconSchema,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useHref } from 'react-router-dom';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import {
  useStoreDispatch, useStoreSelector, useStoreActions, useFlatSequence,
} from '../../store/store';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { PREFIX } from '../../utils/Prefix';

export default function AppHeader() {
  const { config: studyConfig, metadata } = useStoreSelector((state) => state);
  const flatSequence = useFlatSequence();
  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText, toggleShowAdmin } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const currentStep = useCurrentStep();

  const progressBarMax = flatSequence.length - 1;
  const progressPercent = (currentStep / progressBarMax) * 100;

  const [menuOpened, setMenuOpened] = useState(false);

  const logoPath = studyConfig?.uiConfig.logoPath;
  const withProgressBar = studyConfig?.uiConfig.withProgressBar;

  const [searchParams] = useState(new URLSearchParams(window.location.search));
  const admin = searchParams.get('admin') || 'f';

  const studyId = useStudyId();
  const studyHref = useHref(`/${studyId}`);
  function getNewParticipant() {
    storageEngine?.nextParticipant(studyConfig, metadata)
      .then(() => {
        window.location.href = studyHref;
      })
      .catch((err) => {
        console.error(err);
      });
  }

  return (
    <Header height="70" p="md">
      <Grid mt={-7} align="center">
        <Grid.Col span={4}>
          <Flex align="center">
            <Image maw={40} src={`${PREFIX}${logoPath}`} alt="Study Logo" />
            <Space w="md" />
            <Title order={4}>{studyConfig?.studyMetadata.title}</Title>
          </Flex>
        </Grid.Col>

        <Grid.Col span={4}>
          {withProgressBar && (
            <Progress radius="md" size="lg" value={progressPercent} />
          )}
        </Grid.Col>

        <Grid.Col span={4}>
          <Flex align="center" justify="flex-end">
            {studyConfig?.uiConfig.helpTextPath !== undefined && (
              <Button
                variant="outline"
                onClick={() => storeDispatch(toggleShowHelpText())}
              >
                Help
              </Button>
            )}

            <Space w="md" />

            {(import.meta.env.DEV || admin === 't') && (
              <Menu
                shadow="md"
                width={200}
                zIndex={1}
                opened={menuOpened}
                onChange={setMenuOpened}
              >
                <Menu.Target>
                  <ActionIcon size="lg">
                    <IconDotsVertical />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    icon={<IconSchema size={14} />}
                    onClick={() => storeDispatch(toggleShowAdmin())}
                  >
                    Admin Mode
                  </Menu.Item>

                  <Menu.Item
                    component="a"
                    href={
                      studyConfig !== null
                        ? `mailto:${studyConfig.uiConfig.contactEmail}`
                        : undefined
                    }
                    icon={<IconMail size={14} />}
                  >
                    Contact
                  </Menu.Item>

                  <Menu.Item
                    icon={<IconSchema size={14} />}
                    onClick={() => getNewParticipant()}
                  >
                    Next Participant
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Flex>
        </Grid.Col>
      </Grid>
    </Header>
  );
}
