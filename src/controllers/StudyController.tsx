import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, AppShell, Aside, Button, Flex, Grid, Header, Image, Menu, Modal, Navbar, Progress, Space, Text } from '@mantine/core';
import { IconDotsVertical, IconMail, IconSchema } from '@tabler/icons-react';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { useDisclosure } from '@mantine/hooks';
import { useSelector, useDispatch } from 'react-redux';

import { parseStudyConfig } from '../parser/parser';
import { ConsentComponent, StudyConfig, TrialsComponent } from '../parser/types';

import Consent from '../components/Consent';
import TrialController from './TrialController';

import { nextSection, type RootState } from '../store/';


async function fetchStudyConfig(configLocation: string) {
  const config = await (await fetch(configLocation)).text();
  return parseStudyConfig(config);
}

export default function StudyController() {
  const dispatch = useDispatch()

  // Get the whole study config
  const [studyConfig, setStudyConfig] = useState<StudyConfig | null>(null);
  useEffect(() => {
    const fetchData = async () => setStudyConfig(await fetchStudyConfig('/src/configs/config-cleveland.hjson'));
    fetchData();
  }, [])

  const studySequence = useMemo(
    () => studyConfig !== null ? studyConfig.sequence : [],
    [studyConfig],
  )

  // Get the current study section and config for that section
  const currentIndex = useSelector((state: RootState) => state.study.currentIndex)
  const currentStudySection = useMemo(
    () => currentIndex < studySequence.length ? studySequence[currentIndex] : 'endOfStudy',
    [currentIndex, studySequence],
  );
  const currentStudySectionConfig = useMemo(
    () => studyConfig !== null ? studyConfig.components[currentStudySection] : null,
    [studyConfig, currentStudySection],
  );

  // A helper function that will allow the components to move us to the next section
  function goToNextSection() {
    dispatch(nextSection());
  }

  const progressBarCurrent = currentIndex;
  const progressBarMax = studySequence.length;
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
    <AppShell
      navbarOffsetBreakpoint="sm"
      asideOffsetBreakpoint="sm"
      navbar={
        <Navbar p="md" width={{ lg: 300 }} style={{ zIndex: 0 }}>
          <Text>Application navbar</Text>
        </Navbar>
      }
      aside={
          showAdmin
          ? <Aside p="md" width={{ lg: 300 }} style={{ zIndex: 0 }}>
            <Text>Application sidebar</Text>
          </Aside>
          : <></>
      }
      header={
        <Header height="60" p="md">
          <Grid align="center">
            <Grid.Col span={4}>
              <Flex align="center">
                <Image maw={ 40 } src={logoPath} alt="Study Logo" />
                <Space w="md"></Space>
                <Text>{studyConfig?.['study-metadata'].title}</Text>
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
      }
    >

      <Modal opened={helpModalVisible} onClose={close} title="Help">
        <ReactMarkdown>{helpText}</ReactMarkdown>
      </Modal>

      <div>
        { currentStudySection.includes('consent') && currentStudySectionConfig !== null && <Consent goToNextSection={ goToNextSection } currentStudySectionConfig={ currentStudySectionConfig as ConsentComponent }/> }
        { currentStudySection.includes('training') && <div>training component here <Button onClick={goToNextSection}>Accept</Button></div> }
        { currentStudySection.includes('practice') && <div>practice component here <Button onClick={goToNextSection}>Accept</Button></div> }
        { currentStudySection.includes('attention') && <div>attention component here <Button onClick={goToNextSection}>Accept</Button></div> }
        { currentStudySection.includes('trials') && <div><TrialController goToNextSection={goToNextSection} currentStudySectionConfig={currentStudySectionConfig as TrialsComponent} /></div> }
        { currentStudySection.includes('survey') && <div>survey component here <Button onClick={goToNextSection}>Accept</Button></div> }
        { currentStudySection.includes('endOfStudy') && <div>Thanks for completing the study</div> }
      </div>
    </AppShell>
  );
}
