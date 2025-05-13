import {
  Modal, Text, Title, Stack,
} from '@mantine/core';
import { useEffect, useState, useRef } from 'react';
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
  const [timeLeft, setTimeLeft] = useState(10);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { storageEngine } = useStorageEngine();
  const studyId = useStudyId();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      if (minWidth === undefined || minHeight === undefined) {
        return;
      }

      const widthTooSmall = window.innerWidth < minWidth;
      const heightTooSmall = window.innerHeight < minHeight;

      const startCountdown = () => {
        setTimeLeft(10);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        countdownIntervalRef.current = setInterval(() => {
          setTimeLeft((currentTime) => {
            if (currentTime <= 1) {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
              }
              // Reject participant and navigate to screen resolution failed page
              if (storageEngine && !isRejected) {
                setIsRejected(true);
                storageEngine.rejectCurrentParticipant(studyId, 'Screen resolution too small')
                  .then(() => {
                    setTimeout(() => {
                      setShowWarning(false);
                    }, 0);
                  })
                  .catch(() => {
                    console.error('Failed to reject participant who failed training');
                    setTimeout(() => {
                      setShowWarning(false);
                    }, 0);
                  });
              }
              return 0;
            }
            return currentTime - 1;
          });
        }, 1000);
      };

      if (!isRejected && (widthTooSmall || heightTooSmall)) {
        setShowWarning(true);
        startCountdown();
      } else {
        setShowWarning(false);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
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
          Please resize your browser window to the minimum required size within
          {' '}
          {timeLeft}
          {' '}
          seconds.
        </Text>
      </Stack>
    </Modal>
  );
}
