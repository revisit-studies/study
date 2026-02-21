import {
  ActionIcon, Alert, Anchor, Box, Button, Code, Group, Modal, Text,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconCopy } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { useStoreActions, useStoreDispatch, useStoreSelector } from '../../store/store';

export function AlertModal() {
  const alertModal = useStoreSelector((state) => state.alertModal);

  const studyConfig = useStoreSelector((state) => state.config);
  const studyId = useStoreSelector((state) => state.studyId);
  const participantId = useStoreSelector((state) => state.participantId);
  const participantMetadata = useStoreSelector((state) => state.metadata);

  const { setAlertModal } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const [opened, setOpened] = useState(alertModal.show);
  const [copied, setCopied] = useState(false);
  const close = useCallback(() => storeDispatch(setAlertModal({ ...alertModal, show: false, title: '' })), [alertModal, setAlertModal, storeDispatch]);

  useEffect(() => setOpened(alertModal.show), [alertModal.show]);
  const isStorageEngineAlert = alertModal.title === 'Failed to connect to the storage engine';

  const diagnosticsMessage = `Study ID: ${studyId}\nURL: ${window.location.href}\nParticipant ID: ${participantId}\nTimestamp(UTC): ${new Date().toISOString()}\nStorage Engine: ${import.meta.env.VITE_STORAGE_ENGINE}\nUser Agent: ${participantMetadata.userAgent}\nResolution: ${JSON.stringify(participantMetadata.resolution, null, 2)}\nIP: ${participantMetadata.ip}\nLanguage: ${participantMetadata.language}`;

  const handleCopyMessage = useCallback(async () => {
    await navigator.clipboard.writeText(diagnosticsMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }, [diagnosticsMessage]);

  return (
    <Modal
      opened={opened}
      centered
      size={isStorageEngineAlert ? '70%' : 'lg'}
      withCloseButton={false}
      onClose={close}
    >
      <Alert
        color="red"
        radius="xs"
        title={alertModal.title}
        icon={<IconAlertCircle />}
        onClose={close}
        styles={{ root: { backgroundColor: 'unset' } }}
      >
        <Text my="md">
          {alertModal.message}
          {isStorageEngineAlert && (
            <>
              {' '}
              Please email if you need help
              <Anchor href={`mailto:${studyConfig.uiConfig.contactEmail}`} ml={4}>
                {studyConfig.uiConfig.contactEmail}
              </Anchor>
              {' and include the following details to help us troubleshoot the issue:'}
            </>
          )}
        </Text>

        {isStorageEngineAlert && (
          <Box pos="relative">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={handleCopyMessage}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
              }}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
            <Code block>{diagnosticsMessage}</Code>
          </Box>
        )}

        <Group w="100%" justify="end">
          <Button onClick={close} color="red" variant="filled" m="xs">Continue Study</Button>
        </Group>
      </Alert>
    </Modal>
  );
}
