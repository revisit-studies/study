import { Box, Button, Title } from '@mantine/core';
import { useEffect } from 'react';
import { useScreenRecordingContext } from '../../../../store/hooks/useScreenRecording';
import { StimulusParams } from '../../../../store/types';

function ScreenRecordingPermission({ setAnswer }: StimulusParams<undefined>) {
  const {
    recordAudio,
    recordVideoRef,
    startScreenCapture: startCapture,
    stopScreenCapture: stopCapture,
    isScreenCapturing: screenCapturing,
    screenRecordingError: error,
  } = useScreenRecordingContext();

  useEffect(() => {
    setAnswer({
      status: screenCapturing,
      provenanceGraph: undefined,
      answers: {
        screenRecordingPermission: screenCapturing,
      },
    });
  }, [screenCapturing, setAnswer]);

  return (
    <Box p="md">
      <Title order={1} size="h2">
        Screen
        {recordAudio && ' and Audio'}
        {' '}
        Recording Permission
      </Title>

      <p>
        This study requires recording of your screen
        {recordAudio && ' and audio'}
        .
      </p>

      <p>
        Click the button below to grant permission. If you&apos;re not comfortable, you may exit and return the study.
      </p>
      <Button type="button" onClick={screenCapturing ? stopCapture : startCapture}>
        {screenCapturing ? 'Stop Recording' : 'Start Recording'}
      </Button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <p>After providing the permissions, please make sure you are recording the correct tab or window below. Otherwise, stop and re-share the correct one.</p>
      <div style={{ marginTop: '1rem' }}>
        <video
          ref={recordVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '400px', border: '1px solid #ccc' }}
        />
      </div>

      <p>Please do not close the window until the entire study is completed.</p>
    </Box>
  );
}

export default ScreenRecordingPermission;
