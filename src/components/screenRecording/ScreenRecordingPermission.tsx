import { Box, Button, Title } from '@mantine/core';
import { RefObject } from 'react';

function ScreenRecordingPermission({
  recordAudio = false,
  recordVideoRef,
  startCapture,
  stopCapture,
  onConfirm,
  recording,
  error,
}: {
  recordAudio: boolean,
  recordVideoRef: RefObject<HTMLVideoElement | null>,
  onConfirm: () => void,
  startCapture: () => void,
  stopCapture: () => void,
  recording: boolean,
  error: string | null,
}) {
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
      <Button type="button" onClick={recording ? stopCapture : startCapture}>
        {recording ? 'Stop Recording' : 'Start Recording'}
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

      <div>
        <Button onClick={onConfirm} disabled={!recording}>Proceed to Study</Button>
      </div>
    </Box>
  );
}

export default ScreenRecordingPermission;
