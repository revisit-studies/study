import { Navbar, Text } from '@mantine/core';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useComponentStatus } from '../../store/hooks/useComponentStatus';
import ResponseBlock from '../response/ResponseBlock';
import { useCurrentStep } from '../../routes';
import { IndividualComponent } from '../../parser/types';
import { isPartialComponent } from '../../parser/parser';
import merge from 'lodash/merge';

export default function AppNavBar() {
  const trialHasSideBar = useStudyConfig()?.uiConfig.sidebar;
  const trialHasSideBarResponses = true;

  // Get the config for the current step
  const studyConfig = useStudyConfig();
  const step = useCurrentStep();
  const stepConfig = studyConfig.components[step];

  const currentConfig = stepConfig
    ? isPartialComponent(stepConfig) && studyConfig.baseComponents
      ? (merge(
          {},
          studyConfig.baseComponents?.[stepConfig.baseComponent],
          stepConfig
        ) as IndividualComponent)
      : (stepConfig as IndividualComponent)
    : null;
  const status = useComponentStatus();
  const instruction = currentConfig?.instruction || '';

  const instructionInSideBar =
    currentConfig?.instructionLocation === 'sidebar' ||
    currentConfig?.instructionLocation === undefined;

  return trialHasSideBar && currentConfig ? (
    <Navbar bg="gray.1" display="block" width={{ base: 300 }} style={{ zIndex: 0, overflowY: 'scroll' }}>
      {instructionInSideBar && instruction !== '' && (
        <Navbar.Section
          bg="gray.3"
          p="xl"
        >
          <Text c="gray.9">
            <Text span c="orange.8" fw={700} inherit>
              Task:
            </Text>
            <ReactMarkdownWrapper text={instruction} />
          </Text>
        </Navbar.Section>
      )}

      {trialHasSideBarResponses && (
        <Navbar.Section p="xl">
          {
            <ResponseBlock
              status={status}
              config={currentConfig}
              location="sidebar"
            />
          }
        </Navbar.Section>
      )}
    </Navbar>
  ) : (
    <ResponseBlock
      status={status}
      config={currentConfig}
      location="sidebar"
      style={{ display: 'hidden' }}
    />
  );
}
