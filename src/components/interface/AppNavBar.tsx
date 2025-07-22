import { AppShell, Text } from '@mantine/core';
import { useMemo } from 'react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { ResponseBlock } from '../response/ResponseBlock';
import { useCurrentComponent } from '../../routes/utils';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';

export function AppNavBar() {
  // Get the config for the current step
  const studyConfig = useStudyConfig();
  const currentComponent = useCurrentComponent();
  const stepConfig = studyConfig.components[currentComponent];

  const currentConfig = useMemo(() => {
    if (stepConfig) {
      return studyComponentToIndividualComponent(stepConfig, studyConfig);
    }

    return null;
  }, [stepConfig, studyConfig]);

  const status = useStoredAnswer();
  const trialHasSideBar = currentConfig?.withSidebar ?? studyConfig.uiConfig.withSidebar;
  const trialHasSideBarResponses = true;

  const instruction = currentConfig?.instruction || '';
  const instructionLocation = useMemo(() => currentConfig?.instructionLocation ?? studyConfig.uiConfig.instructionLocation ?? 'sidebar', [currentConfig, studyConfig]);
  const instructionInSideBar = instructionLocation === 'sidebar';

  return trialHasSideBar && currentConfig ? (
    <AppShell.Navbar className="sidebar" bg="gray.1" display="block" style={{ zIndex: 0, overflowY: 'scroll' }}>
      {instructionInSideBar && instruction !== '' && (
        <AppShell.Section
          bg="gray.3"
          p="md"
        >
          <Text span c="orange.8" fw={700} inherit>
            Task:
          </Text>
          <ReactMarkdownWrapper text={instruction} />
        </AppShell.Section>
      )}

      {trialHasSideBarResponses && (
        <AppShell.Section p="md">
          <ResponseBlock
            key={`${currentComponent}-sidebar-response-block`}
            status={status}
            config={currentConfig}
            location="sidebar"
          />
        </AppShell.Section>
      )}
    </AppShell.Navbar>
  ) : (
    <AppShell.Navbar bg="gray.1" display="block" style={{ zIndex: 0, overflowY: 'scroll' }}>
      <ResponseBlock
        key={`${currentComponent}-sidebar-response-block`}
        status={status}
        config={currentConfig}
        location="sidebar"
        style={{ display: 'hidden' }}
      />
    </AppShell.Navbar>
  );
}
