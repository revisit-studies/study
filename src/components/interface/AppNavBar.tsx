import { Navbar, Text } from '@mantine/core';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'react-router-dom';
import { useTrialsConfig } from '../../controllers/utils';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useTrialStatus } from '../../store/hooks/useTrialStatus';
import ResponseBlock from '../response/ResponseBlock';

export default function AppNavBar() {
  const trialHasSideBar = useStudyConfig()?.uiConfig.sidebar;
  const trialHasSideBarResponses = true;
  const trialHasSideBarUI = true;

  const { trialId } = useParams<{ trialId: string }>();
  const status = useTrialStatus(trialId || null);
  const config = useTrialsConfig();
  const stimulus = config?.trials[trialId || ''];
  const instruction = stimulus?.instruction || '';

  const instructionInSideBar =
    config?.instructionLocation === 'sidebar' ||
    config?.instructionLocation === undefined;

  return trialHasSideBar ? (
    <Navbar width={{ lg: 300 }} style={{ zIndex: 0 }}>
      {instructionInSideBar && instruction !== '' && (
        <Navbar.Section bg="gray.3" p="xl">
          <Text c="gray.9">
            <Text span c="orange.8" fw={700} inherit>
              Task 8:
            </Text>
            <ReactMarkdown>{instruction}</ReactMarkdown>
          </Text>
        </Navbar.Section>
      )}

      {trialHasSideBarResponses && (
        <Navbar.Section bg="gray.1" p="xl" grow>
          {config && (
            <ResponseBlock status={status} config={config} location="sidebar" />
          )}
        </Navbar.Section>
      )}

      {trialHasSideBarUI && (
        <Navbar.Section p="xl">
          <div id="sidebar-ui"></div>
        </Navbar.Section>
      )}
    </Navbar>
  ) : null;
}
