import {
  Alert, Button, Group, Modal, Text,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { useStoreActions, useStoreDispatch, useStoreSelector } from '../../store/store';

export function AlertModal() {
  const alertModal = useStoreSelector((state) => state.alertModal);
  const { setAlertModal } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const [opened, setOpened] = useState(alertModal.show);
  const close = useCallback(() => storeDispatch(setAlertModal({ ...alertModal, show: false, title: '' })), [alertModal, setAlertModal, storeDispatch]);

  useEffect(() => setOpened(alertModal.show), [alertModal.show]);

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
        <Text my="md">
          {alertModal.message}
        </Text>

        <Group w="100%" justify="end">
          <Button onClick={close} color="red" variant="filled" m="xs">Continue Study</Button>
        </Group>
      </Alert>
    </Modal>
  );
}
