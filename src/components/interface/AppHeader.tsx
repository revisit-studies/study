import { Grid, Flex, Space, Title, Progress, Button, Menu, ActionIcon, Header, Image } from "@mantine/core";
import { IconDotsVertical, IconSchema, IconMail } from "@tabler/icons-react";
import { useAppSelector } from "../../store";
import { useEffect, useState } from "react";
import { useDisclosure } from "@mantine/hooks";


export default function AppHeader() {
  const studyConfig = useAppSelector((state) => state.study.config);

  const progressBarCurrent = 2;
  const progressBarMax = 10;
  const progressPercent = (progressBarCurrent / progressBarMax) * 100;

  const [helpModalVisible, { open, close }] = useDisclosure(false);
  const [menuOpened, setMenuOpened] = useState(false);

  const [showAdmin, setShowAdmin] = useState(false);

  const helpTextPath = studyConfig?.['study-metadata'].helpTextPath;
  const [helpText, setHelpText] = useState('');
  useEffect(() => {
    fetch(helpTextPath !== undefined ? helpTextPath : '')
      .then((response) => response.text())
      .then((text) =>  setHelpText(text));
  }, [helpTextPath]);

  const logoPath = studyConfig?.['study-metadata'].logoPath;
  const withProgressBar = studyConfig?.['study-metadata'].withProgressBar;

  return (
    <Header height="60" p="md">
      <Grid align="center">
        <Grid.Col span={4}>
          <Flex align="center">
            <Image maw={ 40 } src={logoPath} alt="Study Logo" />
            <Space w="md"></Space>
            <Title order={4}>{studyConfig?.['study-metadata'].title}</Title>
          </Flex>
        </Grid.Col>

        <Grid.Col span={4}>
          {withProgressBar && <Progress radius="md" size="lg" value={progressPercent} />}
        </Grid.Col>

        <Grid.Col span={4}>
          <Flex align="center" justify="flex-end">
            {helpText !== "" && <Button variant="outline" onClick={open}>Help</Button>}

            <Space w="md"></Space>

            <Menu shadow="md" width={200} zIndex={1} opened={menuOpened} onChange={setMenuOpened}>
              <Menu.Target>
              <ActionIcon size="lg">
                  <IconDotsVertical />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item icon={<IconSchema size={14} />} onClick={() => setShowAdmin(!showAdmin)}>Admin Mode</Menu.Item>
                <Menu.Item 
                  component="a" 
                  href={studyConfig !== null ? `mailto:${studyConfig['study-metadata'].contactEmail}` : undefined}
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
  )
}
