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
import { PREFIX } from '.././GlobalConfigParser';
import { useCurrentStep, useStudyId } from '../../routes';
import { useStoreDispatch, useStoreSelector, useStoreActions } from '../../store/store';
import { useStorageEngine } from '../../store/storageEngineHooks';
import { useHref } from 'react-router-dom';


export default function AppHeader() {
  const { config: studyConfig, sequence: order } = useStoreSelector((state) => state);
  const storeDispatch = useStoreDispatch();
  const { toggleShowHelpText, toggleShowAdmin } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const currentStep = useCurrentStep();

  const progressBarCurrent =
    studyConfig !== null
      ? order.indexOf(currentStep)
      : 0;
  const progressBarMax = order.length - 1;
  const progressPercent = (progressBarCurrent / progressBarMax) * 100;

  const [menuOpened, setMenuOpened] = useState(false);

  const logoPath = studyConfig?.uiConfig.logoPath;
  const withProgressBar = studyConfig?.uiConfig.withProgressBar;

  const [searchParams] = useState(new URLSearchParams(window.location.search));
  const admin = searchParams.get('admin') || 'f';

  const studyId = useStudyId();
  const studyHref = useHref(`/${studyId}`);
  function getNewParticipant() {
    storageEngine?.nextParticipant()
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
            <Space w="md"></Space>
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

            <Space w="md"></Space>

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
