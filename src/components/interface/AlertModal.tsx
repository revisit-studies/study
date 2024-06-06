import {
  Alert, Box, Button, Modal, Text,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { useStoreActions, useStoreDispatch, useStoreSelector } from '../../store/store';

export function AlertModal() {
  const { alertModal } = useStoreSelector((state) => state);
  const { setAlertModal } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const [opened, setOpened] = useState(alertModal.show);
  const close = useCallback(() => storeDispatch(setAlertModal({ ...alertModal, show: false })), [alertModal, setAlertModal, storeDispatch]);

  useEffect(() => setOpened(alertModal.show), [alertModal.show]);

  return (
    <Modal opened={opened} centered size="lg" withCloseButton={false} onClose={close}>
      <Alert
        color="red"
        radius="xs"
        p="lg"
        title="Alert"
        icon={<IconAlertCircle />}
        onClose={close}
        styles={{ root: { backgroundColor: 'unset' } }}
      >
        <Text my="md">
          {alertModal.message}
        </Text>

        <Box style={{ float: 'right' }} color="red">
          <Button onClick={close} color="red" variant="filled">Continue Study</Button>
        </Box>
      </Alert>
    </Modal>
  );
}
