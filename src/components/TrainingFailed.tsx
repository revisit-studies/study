import { Text } from '@mantine/core';
import { useEffect } from 'react';
import { useStartupInteractionBlocked } from './StartupContext';
import { useStorageEngine } from '../storage/storageEngineHooks';

export function TrainingFailed() {
  const { storageEngine } = useStorageEngine();
  const startupInteractionBlocked = useStartupInteractionBlocked();

  useEffect(() => {
    if (!startupInteractionBlocked && storageEngine) {
      storageEngine.rejectCurrentParticipant('Failed training')
        .catch(() => {
          console.error('Failed to reject participant who failed training');
        });
    }
  }, [startupInteractionBlocked, storageEngine]);

  return (
    <Text>
      Thank you for participating. Unfortunately you didn&apos;t answer the training correctly, which means you are not eligible to participate in the study. You may close this window now.
    </Text>
  );
}
