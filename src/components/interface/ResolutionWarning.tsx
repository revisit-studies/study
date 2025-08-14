import {
  Modal, Text, Title, Stack,
} from '@mantine/core';
import { useEffect, useState, useRef } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStudyId } from '../../routes/utils';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';

export function ResolutionWarning() {
  const studyConfig = useStudyConfig();
  const minWidth = studyConfig.uiConfig.minWidthSize;
  const minHeight = studyConfig.uiConfig.minHeightSize;

  const [showWarning, setShowWarning] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isTimedOut, setIsTimedOut] = useState(false);
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
      const needsResize = widthTooSmall || heightTooSmall;

      const startCountdown = () => {
        setTimeLeft(60);
        // Clear existing countdown
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        countdownIntervalRef.current = setInterval(() => {
          setTimeLeft((currentTime) => {
            if (currentTime <= 1) {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              // Reject participant if they haven't resized in time
              if (storageEngine && !isRejected) {
                setIsRejected(true);
                setIsTimedOut(true);
                storageEngine.rejectCurrentParticipant('Screen resolution too small')
                  .catch(() => {
                    console.error('Failed to reject participant who failed training');
                  });
              }
              return 0;
            }
            return currentTime - 1;
          });
        }, 1000);
      };

      if (isRejected) return;

      if (needsResize) {
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
          {isTimedOut ? (
            <>
              Thank you for participating in this study. You have been timed out and will not be able to continue.
              <br />
              You may now close this page.
            </>
          ) : (
            <>
              Your screen resolution is below the minimum requirement:
              <br />
              {minWidth !== undefined && ` Width: ${minWidth}px`}
              {minHeight !== undefined && ` Height: ${minHeight}px`}
              <br />
              Please resize your browser window to the minimum required size within
              {' '}
              {timeLeft}
              {' '}
              seconds.
            </>
          )}
        </Text>
      </Stack>
    </Modal>
  );
}
