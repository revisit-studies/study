import {
  Modal, Text, Title, Stack,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export function ScreenRecordingRejection() {
  return (
    <Modal opened onClose={() => {}} fullScreen withCloseButton={false}>
      <Stack align="center" justify="center">
        <IconAlertTriangle size={64} color="orange" />
        <Title order={3}> Screen Recording Stopped </Title>
        <Text size="md" ta="center">
          <>
            Thank you for participating in this study. Screen recording was stopped and you will not be able to continue.
            <br />
            You may now close this page.
          </>
        </Text>
      </Stack>
    </Modal>
  );
}
