import {
  Modal, Text, Title, Stack,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export function ScreenRecordingRejection({ saving = false }: { saving?: boolean }) {
  return (
    <Modal opened onClose={() => {}} fullScreen withCloseButton={false}>
      <Stack align="center" justify="center">
        <IconAlertTriangle size={64} color="var(--mantine-color-orange-text)" />
        <Title order={3}>{saving ? 'Saving Recording' : 'Recording Stopped'}</Title>
        <Text size="md" ta="center">
          {saving ? (
            'Please keep this page open while the recording and your study data are saved.'
          ) : (
            <>
              Thank you for participating in this study. Recording was stopped and you will not be able to continue.
              <br />
              You may now close this page.
            </>
          )}
        </Text>
      </Stack>
    </Modal>
  );
}
