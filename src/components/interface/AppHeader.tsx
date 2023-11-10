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
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PREFIX } from '.././GlobalConfigParser';
import { useCurrentStep } from '../../routes';
import { useAppSelector, useCreatedStore } from '../../store/store';
import {
  toggleShowAdmin,
  toggleShowHelpText,
  useFlagsDispatch,
} from '../../store/flags';

export default function AppHeader() {
  const studyConfig = useAppSelector((state) => state.unTrrackedSlice.config);
  const order = useAppSelector((state) => state.trrackedSlice.order);

  const clearCache = useCreatedStore().clearCache;
  const flagsDispatch = useFlagsDispatch();
  const navigate = useNavigate();

  const currentStep = useCurrentStep();

  const progressBarCurrent =
    studyConfig !== null
      ? currentStep === 'end'
        ? 100
        : order.indexOf(currentStep)
      : 0;
  const progressBarMax = order.length || 0;
  const progressPercent = (progressBarCurrent / progressBarMax) * 100;

  const [menuOpened, setMenuOpened] = useState(false);

  const logoPath = studyConfig?.uiConfig.logoPath;
  const withProgressBar = studyConfig?.uiConfig.withProgressBar;

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
                onClick={() => flagsDispatch(toggleShowHelpText())}
              >
                Help
              </Button>
            )}

            <Space w="md"></Space>

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
                  onClick={() => flagsDispatch(toggleShowAdmin())}
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
                  onClick={async () => {
                    await clearCache();
                    navigate(0);
                  }}
                  icon={<IconTrash size={14} />}
                >
                  Clear Cache & Refresh
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Flex>
        </Grid.Col>
      </Grid>
    </Header>
  );
}
