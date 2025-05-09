import {
  Modal, Text, Title, Stack,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useStoreSelector } from '../../store/store';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStudyId } from '../../routes/utils';

export function ResolutionWarning() {
  const studyConfig = useStoreSelector((state) => state.config);

  const minWidth = studyConfig.uiConfig.minWidthSize;
  const minHeight = studyConfig.uiConfig.minHeightSize;

  const [showWarning, setShowWarning] = useState(false);
  const [isRejected, setIsRejected] = useState(false);

  const { storageEngine } = useStorageEngine();
  const studyId = useStudyId();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      const widthTooSmall = minWidth != null && window.innerWidth < minWidth;
      const heightTooSmall = minHeight != null && window.innerHeight < minHeight;

      if (!isRejected && (widthTooSmall || heightTooSmall)) {
        setShowWarning(true);

        if (storageEngine) {
          setIsRejected(true);
          storageEngine.rejectCurrentParticipant(studyId, 'Screen resolution too small')
            .then(() => {
              setTimeout(() => {
                setShowWarning(false);
              }, 5000);
            })
            .catch(() => {
              console.error('Failed to reject participant who failed training');
              setTimeout(() => {
                setShowWarning(false);
              }, 5000);
            });
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minWidth, minHeight, storageEngine, studyId, navigate, isRejected]);

  if (!showWarning) {
    return null;
  }

  return (
    <Modal opened={showWarning} onClose={() => {}} fullScreen withCloseButton={false}>
      <Stack align="center" justify="center">
        <IconAlertTriangle size={64} color="orange" />
        <Title order={3}> Screen Resolution Warning </Title>
        <Text size="md" ta="center">
          Your screen resolution is below the minimum requirement:
          <br />
          {minWidth !== undefined && ` Width: ${minWidth}px`}
          {minHeight !== undefined && ` Height: ${minHeight}px`}
        </Text>
        <Text size="md" ta="center">
          Please resize your browser window to the minimum required size.
        </Text>
      </Stack>
    </Modal>
  );
}
