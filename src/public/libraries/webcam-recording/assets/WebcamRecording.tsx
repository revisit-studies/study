import {
  Box, Button, Title,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useRecordingContext } from '../../../../store/hooks/useRecording';
import { StimulusParams } from '../../../../store/types';
import { RecordingAudioWaveform } from '../../../../components/interface/RecordingAudioWaveform';

function WebcamRecordingPermission({ setAnswer }: StimulusParams<undefined>) {
  const {
    recordAudio,
    webcamVideoRef,
    startWebcamCapture,
    stopScreenCapture,
    isWebcamCapturing,
    screenRecordingError: error,
    audioMediaStream,
  } = useRecordingContext();

  const [audioCapturingSuccess, setAudioCapturingSuccess] = useState(false);

  const setupComplete = useMemo(
    () => isWebcamCapturing && (!recordAudio || audioCapturingSuccess),
    [audioCapturingSuccess, isWebcamCapturing, recordAudio],
  );

  useEffect(() => {
    setAnswer({
      status: setupComplete,
      provenanceGraph: undefined,
      answers: {
        webcamRecordingPermission: isWebcamCapturing,
      },
    });
  }, [isWebcamCapturing, setAnswer, setupComplete]);

  useEffect(() => {
    if (!isWebcamCapturing || !recordAudio) {
      return undefined;
    }

    const stream = audioMediaStream.current;
    if (!stream) {
      return undefined;
    }

    const audioContext = new AudioContext();
    const audioStreamSource = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.minDecibels = -45;
    audioStreamSource.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const domainData = new Uint8Array(bufferLength);
    let soundDetected = false;
    let animationFrame = 0;

    const detectSound = () => {
      if (soundDetected) {
        return;
      }

      analyser.getByteFrequencyData(domainData);

      for (let i = 0; i < bufferLength; i += 1) {
        if (domainData[i] > 0) {
          soundDetected = true;
          setAudioCapturingSuccess(true);
          return;
        }
      }

      animationFrame = window.requestAnimationFrame(detectSound);
    };

    animationFrame = window.requestAnimationFrame(detectSound);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      audioStreamSource.disconnect();
      analyser.disconnect();
      audioContext.close().catch(() => undefined);
    };
  }, [audioMediaStream, isWebcamCapturing, recordAudio]);

  return (
    <Box p="md">
      <Title order={1} size="h2">
        Webcam
        {recordAudio && ' and Audio'}
        {' '}
        Recording Permission
      </Title>

      <p>
        This study requires recording of your
        {' '}
        <strong>
          webcam
          {recordAudio ? ' and audio' : ''}
        </strong>
        . If you&apos;re not comfortable, you may exit and return the study.
      </p>
      <p>Follow the steps below to grant the required permissions.</p>

      <ol>
        <li>
          <strong>Click the button below</strong>
          {' '}
          to enable webcam recording.
          <Button type="button" onClick={isWebcamCapturing ? stopScreenCapture : startWebcamCapture} display="block" mt="sm">
            {isWebcamCapturing ? 'Stop Recording' : 'Start Recording'}
          </Button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </li>
        <li>
          <strong>Confirm your webcam preview</strong>
          {' '}
          before continuing.
          <video
            ref={webcamVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '320px',
              border: '1px solid #ccc',
              marginTop: '1rem',
              transform: 'scaleX(-1)',
            }}
          />
        </li>
        {recordAudio && (
          <li>
            <strong>Speak</strong>
            {' '}
            into your microphone to check if audio is working.
            {isWebcamCapturing ? (
              <Box h={200} w={400} bd="1px solid #ccc">
                <RecordingAudioWaveform height={200} width={400} />
              </Box>
            ) : <Box h={200} w={400} bd="1px solid #ccc" />}
          </li>
        )}
      </ol>
      <strong>Note:</strong>
      <ul>
        {recordAudio && (
          <li>
            After we hear you say something, the
            {' '}
            <b>Continue</b>
            {' '}
            button will be enabled.
          </li>
        )}
        <li>Please do not stop the webcam recording stream until the entire study is completed.</li>
      </ul>
    </Box>
  );
}

export default WebcamRecordingPermission;
