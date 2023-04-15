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
} from "@mantine/core";
import { IconDotsVertical, IconMail, IconSchema } from "@tabler/icons-react";
import { useState } from "react";
import { useCurrentStep } from "../../routes";
import { useAppSelector } from "../../store";
import {
  toggleShowAdmin,
  toggleShowHelpText,
  useFlagsDispatch,
} from "../../store/flags";

export default function AppHeader() {
  const studyConfig = useAppSelector((state) => state.study.config);
  const flagsDispatch = useFlagsDispatch();

  const currentStep = useCurrentStep();

  const progressBarCurrent = studyConfig?.sequence.indexOf(currentStep) || 0;
  const progressBarMax = studyConfig?.sequence.length || 0;
  const progressPercent = (progressBarCurrent / progressBarMax) * 100;

  const [menuOpened, setMenuOpened] = useState(false);

  const logoPath = studyConfig?.["study-metadata"].logoPath;
  const withProgressBar = studyConfig?.["study-metadata"].withProgressBar;

  return (
    <Header height="60" p="md">
      <Grid align="center">
        <Grid.Col span={4}>
          <Flex align="center">
            <Image maw={40} src={logoPath} alt="Study Logo" />
            <Space w="md"></Space>
            <Title order={4}>{studyConfig?.["study-metadata"].title}</Title>
          </Flex>
        </Grid.Col>

        <Grid.Col span={4}>
          {withProgressBar && (
            <Progress radius="md" size="lg" value={progressPercent} />
          )}
        </Grid.Col>

        <Grid.Col span={4}>
          <Flex align="center" justify="flex-end">
            {studyConfig?.["study-metadata"].helpTextPath !== undefined && (
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
                      ? `mailto:${studyConfig["study-metadata"].contactEmail}`
                      : undefined
                  }
                  icon={<IconMail size={14} />}
                >
                  Contact
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Flex>
        </Grid.Col>
      </Grid>
    </Header>
  );
}
