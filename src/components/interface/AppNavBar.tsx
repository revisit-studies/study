import { Navbar, Text } from '@mantine/core';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import ResponseBlock from '../stimuli/inputcomponents/ResponseBlock';

export default function AppNavBar() {
  const trialHasSideBar = useStudyConfig()?.uiConfig.sidebar;
  const trialHasSideBarResponses = true;
  const trialHasSideBarUI = true;

  return trialHasSideBar ? (
    <Navbar width={{ lg: 300 }} style={{ zIndex: 0 }}>
      <Navbar.Section bg="gray.3" p="xl">
        <Text c="gray.9"><Text span c="orange.8" fw={700} inherit>Task 8:</Text> Task Instructions</Text>
      </Navbar.Section>

      {trialHasSideBarResponses && 
      <Navbar.Section bg="gray.1" p="xl" grow>
          <ResponseBlock location="sidebar"/>
      </Navbar.Section>}

      {trialHasSideBarUI && 
      <Navbar.Section p="xl">
        <div id="sidebar-ui"></div>
      </Navbar.Section>}
    </Navbar>
  ) : null;
}
