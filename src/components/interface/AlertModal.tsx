import {
  Alert, Anchor, Button, Group, Modal, Text,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { useStoreActions, useStoreDispatch, useStoreSelector } from '../../store/store';

const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,})/g;
const SINGLE_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

export function AlertModal() {
  const alertModal = useStoreSelector((state) => state.alertModal);
  const { setAlertModal } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const [opened, setOpened] = useState(alertModal.show);
  const close = useCallback(() => storeDispatch(setAlertModal({ ...alertModal, show: false, title: '' })), [alertModal, setAlertModal, storeDispatch]);

  useEffect(() => setOpened(alertModal.show), [alertModal.show]);

  const messageParts = alertModal.message.split(EMAIL_REGEX);

  return (
    <Modal opened={opened} centered size="lg" withCloseButton={false} onClose={close}>
      <Alert
        color="red"
        radius="xs"
        title={alertModal.title}
        icon={<IconAlertCircle />}
        onClose={close}
        styles={{ root: { backgroundColor: 'unset' } }}
      >
        <Text my="md" style={{ whiteSpace: 'pre-line' }}>
          {messageParts.map((part, index) => {
            if (SINGLE_EMAIL_REGEX.test(part)) {
              return <Anchor key={`email-${part}-${index}`} href={`mailto:${part}`}>{part}</Anchor>;
            }
            return <span key={`text-${index}`}>{part}</span>;
          })}
        </Text>

        <Group w="100%" justify="end">
          <Button onClick={close} color="red" variant="filled" m="xs">Continue Study</Button>
        </Group>
      </Alert>
    </Modal>
  );
}
