import {
  Box, Button, Flex, Title,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useRecordingContext } from '../../../../store/hooks/useRecording';
import { StimulusParams } from '../../../../store/types';
import { RecordingAudioWaveform } from '../../../../components/interface/RecordingAudioWaveform';

function ScreenRecordingPermission({ setAnswer }: StimulusParams<undefined>) {
  const {
    studyHasAudioRecording,
    studyHasWebcamRecording,
    recordVideoRef,
    webcamVideoRef,
    startScreenCapture: startCapture,
    stopScreenCapture: stopCapture,
    isScreenCapturing: screenCapturing,
    isAudioCapturing: audioCapturing,
    isWebcamCapturing: webcamCapturing,
    isMediaCapturing: mediaCapturing,
    screenRecordingError,
    audioRecordingError,
    audioMediaStream,
  } = useRecordingContext();

  const [audioCapturingSuccess, setAudioCapturingSuccess] = useState(false);
  const setupComplete = useMemo(
    () => screenCapturing
      && (!studyHasWebcamRecording || webcamCapturing)
      && (!studyHasAudioRecording || (audioCapturing && audioCapturingSuccess)),
    [
      audioCapturingSuccess,
      audioCapturing,
      screenCapturing,
      studyHasAudioRecording,
      studyHasWebcamRecording,
      webcamCapturing,
    ],
  );

  useEffect(() => {
    if (!audioCapturing) {
      setAudioCapturingSuccess(false);
    }
  }, [audioCapturing]);

  useEffect(() => {
    setAnswer({
      status: setupComplete,
      answers: {
        screenRecordingPermission: screenCapturing,
      },
    });
  }, [screenCapturing, setAnswer, setupComplete]);

  useEffect(() => {
    if (!audioCapturing || !studyHasAudioRecording || !audioMediaStream.current) {
      return undefined;
    }

    const audioContext = new AudioContext();
    const audioStreamSource = audioContext.createMediaStreamSource(audioMediaStream.current);
    const analyser = audioContext.createAnalyser();
    analyser.minDecibels = -45;
    audioStreamSource.connect(analyser);

    const domainData = new Uint8Array(analyser.frequencyBinCount);
    let animationFrame = 0;
    const detectSound = () => {
      analyser.getByteFrequencyData(domainData);
      if (domainData.some((value) => value > 0)) {
        setAudioCapturingSuccess(true);
        return;
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
  }, [audioCapturing, audioMediaStream, studyHasAudioRecording]);

  const recordingTargets = [
    'screen',
    ...(studyHasWebcamRecording ? ['webcam'] : []),
    ...(studyHasAudioRecording ? ['audio'] : []),
  ];

  return (
    <Box p="md">
      <Title order={1} size="h2">
        Screen
        {studyHasWebcamRecording && ', Webcam'}
        {studyHasAudioRecording && `${studyHasWebcamRecording ? ',' : ' and'} Audio`}
        {' '}
        Recording Permission
      </Title>

      <p>
        This study requires recording of your
        {' '}
        <strong>{recordingTargets.join(', ')}</strong>
        . If you&apos;re not comfortable, you may exit and return the study.
      </p>
      <p>Follow the steps below to grant the required permissions.</p>

      <ol>
        <li>
          <strong>Click the button below</strong>
          {' '}
          to enable the required recording streams.
          <Button type="button" onClick={mediaCapturing ? stopCapture : startCapture} display="block" mt="sm">
            {mediaCapturing ? 'Stop Recording' : 'Start Recording'}
          </Button>
          {screenRecordingError && <p style={{ color: 'red' }}>{screenRecordingError}</p>}
          {audioRecordingError && <p style={{ color: 'red' }}>{audioRecordingError}</p>}
          <p><i>Please make sure you are recording the correct tab or window. Otherwise, stop and re-share the correct one.</i></p>
        </li>
        <li>
          <strong>Confirm your preview streams</strong>
          {' '}
          before continuing.
          <Flex mt="sm" gap="md" wrap="wrap">
            <Box>
              <p><strong>Screen Preview</strong></p>
              <video
                ref={recordVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '400px', border: '1px solid #ccc' }}
              />
            </Box>
            {studyHasWebcamRecording && (
              <Box>
                <p><strong>Webcam Preview</strong></p>
                <video
                  ref={webcamVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '300px', border: '1px solid #ccc', transform: 'scaleX(-1)' }}
                />
              </Box>
            )}
          </Flex>
        </li>
        {studyHasAudioRecording && (
          <li>
            <strong>Speak</strong>
            {' '}
            into your microphone to check if audio is working.
            {audioCapturing ? <Box h={200} w={400} bd="1px solid #ccc"><RecordingAudioWaveform height={200} width={400} /></Box> : <Box h={200} w={400} bd="1px solid #ccc" />}
          </li>
        )}
      </ol>
      <strong>Note:</strong>
      <ul>
        {studyHasAudioRecording && <li>After we hear you say something, the Continue button will be enabled.</li>}
        <li>Please do not stop the recording streams until the entire study is completed.</li>
      </ul>
    </Box>
  );
}

export default ScreenRecordingPermission;
