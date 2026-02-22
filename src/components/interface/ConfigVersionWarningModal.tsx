import {
  Alert, Button, Group, Modal, Text,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useHref } from 'react-router';
import { useStoreSelector } from '../../store/store';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStudyId } from '../../routes/utils';
import { getNewParticipant } from '../../utils/nextParticipant';

export function ConfigVersionWarningModal() {
  const isStalledConfig = useStoreSelector((state) => state.isStalledConfig);
  const [opened, setOpened] = useState(isStalledConfig);

  useEffect(() => setOpened(isStalledConfig), [isStalledConfig]);

  const { storageEngine } = useStorageEngine();
  const studyId = useStudyId();
  const studyHref = useHref(`/${studyId}`);

  return (
    <Modal opened={opened} centered size="lg" withCloseButton={false} closeOnClickOutside={false} closeOnEscape={false} onClose={() => {}}>
      <Alert
        color="yellow"
        radius="xs"
        title="Study Configuration Has Changed"
        icon={<IconAlertCircle />}
        styles={{ root: { backgroundColor: 'unset' } }}
      >
        <Text my="md">
          The study configuration has been updated since this participant session was started.
          You are currently viewing the study with an older version of the configuration.
          Click &quot;Next Participant&quot; to begin a fresh session using the latest configuration.
        </Text>

        <Group w="100%" justify="end">
          <Button onClick={() => getNewParticipant(storageEngine, studyHref)} color="yellow" variant="filled">
            Next Participant
          </Button>
        </Group>
      </Alert>
    </Modal>
  );
}
