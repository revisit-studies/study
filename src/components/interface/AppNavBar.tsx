import { AppShell, Text } from '@mantine/core';
import merge from 'lodash.merge';
import { useMemo } from 'react';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import ResponseBlock from '../response/ResponseBlock';
import { useCurrentStep } from '../../routes/utils';
import { IndividualComponent } from '../../parser/types';
import { isInheritedComponent } from '../../parser/parser';
import { useFlatSequence } from '../../store/store';

export default function AppNavBar() {
  const trialHasSideBar = useStudyConfig()?.uiConfig.sidebar;
  const trialHasSideBarResponses = true;

  // Get the config for the current step
  const studyConfig = useStudyConfig();
  const currentStep = useCurrentStep();
  const currentComponent = useFlatSequence()[currentStep];
  const stepConfig = studyConfig.components[currentComponent];

  const currentConfig = useMemo(() => {
    if (stepConfig) {
      return isInheritedComponent(stepConfig) && studyConfig.baseComponents
        ? (merge(
          {},
          studyConfig.baseComponents?.[stepConfig.baseComponent],
          stepConfig,
        ) as IndividualComponent)
        : (stepConfig as IndividualComponent);
    }

    return null;
  }, [stepConfig, studyConfig.baseComponents]);

  const status = useStoredAnswer();
  const instruction = currentConfig?.instruction || '';

  const instructionInSideBar = currentConfig?.instructionLocation === 'sidebar'
    || currentConfig?.instructionLocation === undefined;

  return trialHasSideBar && currentConfig ? (
    <AppShell.Navbar bg="gray.1" display="block" style={{ zIndex: 0, overflowY: 'scroll' }}>
      {instructionInSideBar && instruction !== '' && (
        <AppShell.Section
          bg="gray.3"
          p="xl"
        >
          <Text c="gray.9">
            <Text span c="orange.8" fw={700} inherit>
              Task:
            </Text>
            <ReactMarkdownWrapper text={instruction} />
          </Text>
        </AppShell.Section>
      )}

      {trialHasSideBarResponses && (
        <AppShell.Section p="sm">
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
    <ResponseBlock
      key={`${currentComponent}-sidebar-response-block`}
      status={status}
      config={currentConfig}
      location="sidebar"
      style={{ display: 'hidden' }}
    />
  );
}
