import { Text } from '@mantine/core';
import { useStorageEngine } from '../storage/storageEngineHooks';

export function TrainingFailed() {
  const { storageEngine } = useStorageEngine();

  if (storageEngine) {
    storageEngine.rejectCurrentParticipant('Failed training')
      .catch(() => {
        console.error('Failed to reject participant who failed training');
      });
  }

  return (
    <Text>
      Thank you for participating. Unfortunately you have didn&apos;t answer the training correctly, which means you are not eligible to participate in the study. You may close this window now.
    </Text>
  );
}
