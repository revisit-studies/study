import {
  ActionIcon, Alert, Anchor, Box, Button, Code, Group, Modal, Text,
} from '@mantine/core';
import {
  IconAlertCircle, IconCheck, IconCopy, IconExternalLink,
} from '@tabler/icons-react';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useStoreActions, useStoreDispatch, useStoreSelector } from '../../store/store';
import { useStorageEngine } from '../../storage/storageEngineHooks';

export function AlertModal() {
  const alertModal = useStoreSelector((state) => state.alertModal);

  const studyConfig = useStoreSelector((state) => state.config);
  const studyId = useStoreSelector((state) => state.studyId);
  const participantId = useStoreSelector((state) => state.participantId);
  const participantMetadata = useStoreSelector((state) => state.metadata);

  const { setAlertModal } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const { storageEngine } = useStorageEngine();

  const [opened, setOpened] = useState(alertModal.show);
  const [copied, setCopied] = useState(false);
  const [copiedIndexUrl, setCopiedIndexUrl] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const close = useCallback(() => storeDispatch(setAlertModal({ ...alertModal, show: false, title: '' })), [alertModal, setAlertModal, storeDispatch]);

  useEffect(() => setOpened(alertModal.show), [alertModal.show]);
  const isSaveResponseAlert = alertModal.title === 'Failed to Save Response';
  const isStorageEngineAlert = alertModal.title === 'Failed to connect to the storage engine' || isSaveResponseAlert;
  const handleClose = useCallback(() => {
    if (isStorageEngineAlert) {
      return;
    }
    close();
  }, [close, isStorageEngineAlert]);

  const handleStorageAction = useCallback(async () => {
    if (!isSaveResponseAlert) {
      window.location.reload();
      return;
    }

    if (!storageEngine) {
      return;
    }

    setIsRetrying(true);
    try {
      await storageEngine.retryFailedWrites();
      close();
    } catch (error) {
      console.error('Failed to retry participant response data persistence', error);
    } finally {
      setIsRetrying(false);
    }
  }, [close, isSaveResponseAlert, storageEngine]);

  const diagnosticsMessage = useMemo(() => {
    if (!opened || !isStorageEngineAlert) {
      return '';
    }
    return `Study ID: ${studyId}\nURL: ${window.location.href}\nParticipant ID: ${participantId}\nTimestamp (UTC): ${new Date().toISOString()}\nStorage Engine: ${import.meta.env.VITE_STORAGE_ENGINE}\nUser Agent: ${participantMetadata.userAgent}\nResolution: ${JSON.stringify(participantMetadata.resolution, null, 2)}\nIP: ${participantMetadata.ip}\nLanguage: ${participantMetadata.language}`;
  }, [opened, isStorageEngineAlert, studyId, participantId, participantMetadata]);

  const mailTemplate = useMemo(() => {
    const subject = encodeURIComponent(`Storage Connection Issue (${studyId})`);
    const body = encodeURIComponent(`I encountered a storage connection issue while taking a study.\n\n Warning message:\n${alertModal.message}\n\nDiagnostics information:\n${diagnosticsMessage}`);
    return `mailto:${studyConfig.uiConfig.contactEmail}?subject=${subject}&body=${body}`;
  }, [alertModal.message, diagnosticsMessage, studyConfig.uiConfig.contactEmail, studyId]);

  const firebaseIndexUrl = useMemo(() => {
    if (!alertModal.message.toLowerCase().includes('query requires an index')) {
      return null;
    }
    return alertModal.message.match(/https:\/\/console\.firebase\.google\.com\/\S+/)?.[0] ?? null;
  }, [alertModal.message]);

  const handleCopyMessage = useCallback(async () => {
    try {
      if (!window.isSecureContext || !navigator.clipboard?.writeText) return;
      await navigator.clipboard.writeText(diagnosticsMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {
      // Fail silently when clipboard access is unavailable or denied.
    }
  }, [diagnosticsMessage]);

  const handleCopyIndexUrl = useCallback(async () => {
    try {
      if (!firebaseIndexUrl || !window.isSecureContext || !navigator.clipboard?.writeText) return;
      await navigator.clipboard.writeText(firebaseIndexUrl);
      setCopiedIndexUrl(true);
      setTimeout(() => setCopiedIndexUrl(false), 1000);
    } catch {
      // Fail silently when clipboard access is unavailable or denied.
    }
  }, [firebaseIndexUrl]);

  return (
    <Modal
      opened={opened}
      centered
      size={isStorageEngineAlert ? '70%' : 'lg'}
      withCloseButton={false}
      onClose={handleClose}
      styles={{
        body: {
          maxHeight: '75vh',
          overflowX: 'hidden',
          overflowY: 'auto',
        },
      }}
    >
      <Alert
        color="red"
        radius="xs"
        title={alertModal.title}
        icon={<IconAlertCircle />}
        onClose={isStorageEngineAlert ? undefined : close}
        styles={{ root: { backgroundColor: 'unset' } }}
      >
        {firebaseIndexUrl ? (
          <>
            <Text my="xs">
              Firebase requires a composite index before this study can load. Creating it is a one-time setup for this Firebase project/database and does not need to be repeated for each study. The study owner must administer the Firebase deployment to complete this step.
            </Text>
            <Group my="md">
              <Button
                component="a"
                href={firebaseIndexUrl}
                target="_blank"
                rel="noreferrer"
                leftSection={<IconExternalLink size={16} />}
              >
                Open Firebase index setup
              </Button>
              <Button
                variant="outline"
                leftSection={copiedIndexUrl ? <IconCheck size={16} /> : <IconCopy size={16} />}
                onClick={handleCopyIndexUrl}
              >
                {copiedIndexUrl ? 'Copied' : 'Copy setup URL'}
              </Button>
            </Group>
            <Code
              block
              style={{
                overflowWrap: 'anywhere',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {firebaseIndexUrl}
            </Code>
          </>
        ) : (
          <Text my="xs">
            {alertModal.message}
          </Text>
        )}
        {isStorageEngineAlert && (
          <Text my="xs">
            Please email if you need help
            {' '}
            <Anchor href={mailTemplate}>
              {studyConfig.uiConfig.contactEmail}
            </Anchor>
            {' '}
            and include the following details to help us troubleshoot the issue:
          </Text>
        )}

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
          <Button
            onClick={isStorageEngineAlert ? handleStorageAction : close}
            color="red"
            variant="filled"
            m="xs"
            loading={isRetrying}
          >
            {isSaveResponseAlert ? 'Retry' : (isStorageEngineAlert ? 'Reconnect' : 'Continue Study')}
          </Button>
        </Group>
      </Alert>
    </Modal>
  );
}
