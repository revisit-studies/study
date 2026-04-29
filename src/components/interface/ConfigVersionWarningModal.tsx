import {
  Affix, Alert, Button, Group, Text,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useHref } from 'react-router';
import { useStoreSelector } from '../../store/store';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStudyId } from '../../routes/utils';
import { getNewParticipant } from '../../utils/nextParticipant';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';

export function ConfigVersionWarningModal() {
  const isStalledConfig = useStoreSelector((state) => state.isStalledConfig);
  const developmentModeEnabled = useStoreSelector((state) => state.modes.developmentModeEnabled);
  const studyConfig = useStudyConfig();
  const contactEmail = studyConfig?.uiConfig?.contactEmail;
  const isAnalysis = useIsAnalysis();
  const [opened, setOpened] = useState(isStalledConfig && !isAnalysis);

  useEffect(() => {
    if (isStalledConfig && !isAnalysis) {
      setOpened(true);
      return;
    }

    setOpened(false);
  }, [isAnalysis, isStalledConfig]);

  useEffect(() => {
    if (!opened) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setOpened(false), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [opened]);

  const { storageEngine } = useStorageEngine();
  const studyId = useStudyId();
  const studyHref = useHref(`/${studyId}`);

  if (!opened) {
    return null;
  }

  return (
    <Affix position={{ top: 20, right: 20 }} zIndex={300}>
      <Alert
        color="yellow"
        radius="sm"
        title="Study Configuration Has Changed"
        icon={<IconAlertCircle />}
        w={420}
        withCloseButton
        onClose={() => setOpened(false)}
        styles={{
          root: {
            backgroundColor: 'var(--mantine-color-yellow-1)',
            borderColor: 'var(--mantine-color-yellow-4)',
            opacity: 1,
          },
        }}
      >
        <Text my="md">
          {developmentModeEnabled
            ? 'The study configuration has changed since this participant session started. You might need to click "Next Participant" to refresh and load the latest version.'
            : `The study configuration has changed since this participant session started. Please contact the study administrator${contactEmail ? ` at ${contactEmail}` : ''}.`}
        </Text>
        {developmentModeEnabled && (
          <Group w="100%" justify="end">
            <Button onClick={() => getNewParticipant(storageEngine, studyHref)} color="yellow" variant="filled">
              Next Participant
            </Button>
          </Group>
        )}
      </Alert>
    </Affix>
  );
}
