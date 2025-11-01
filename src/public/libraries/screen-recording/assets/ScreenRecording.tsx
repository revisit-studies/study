import {
  Box, Button, Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { useScreenRecordingContext } from '../../../../store/hooks/useScreenRecording';
import { StimulusParams } from '../../../../store/types';
import { RecordingAudioWaveform } from '../../../../components/interface/RecordingAudioWaveform';

function ScreenRecordingPermission({ setAnswer }: StimulusParams<undefined>) {
  const {
    recordAudio,
    recordVideoRef,
    startScreenCapture: startCapture,
    stopScreenCapture: stopCapture,
    isScreenCapturing: screenCapturing,
    screenRecordingError: error,
    audioMediaStream,
  } = useScreenRecordingContext();

  // audioCapturingSuccess is set to true when we detect sound.
  const [audioCapturingSuccess, setAudioCapturingSuccess] = useState(false);

  useEffect(() => {
    setAnswer({
      status: screenCapturing && (recordAudio ? audioCapturingSuccess : true),
      provenanceGraph: undefined,
      answers: {
        screenRecordingPermission: screenCapturing,
      },
    });
  }, [screenCapturing, audioCapturingSuccess, setAnswer, recordAudio]);

  useEffect(() => {
    if (!screenCapturing) {
      return;
    }
    const stream = audioMediaStream.current;
    if (!stream) {
      return;
    }

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();

    const audioContext = new AudioContext();
    const audioStreamSource = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.minDecibels = -45;
    audioStreamSource.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const domainData = new Uint8Array(bufferLength);

    let soundDetected = false;

    const detectSound = () => {
      if (soundDetected) {
        return;
      }

      analyser.getByteFrequencyData(domainData);

      for (let i = 0; i < bufferLength; i += 1) {
        if (domainData[i] > 0) {
          soundDetected = true;
          setAudioCapturingSuccess(true);
        }
      }

      window.requestAnimationFrame(detectSound);
    };

    window.requestAnimationFrame(detectSound);
  }, [audioMediaStream, screenCapturing, setAnswer]);

  return (
    <Box p="md">
      <Title order={1} size="h2">
        Screen
        {recordAudio && ' and Audio'}
        {' '}
        Recording Permission
      </Title>

      {recordAudio ? (
        <>
          {/* Record both screen and audio */}
          <p>
            This study requires recording of your
            {' '}
            <strong>screen</strong>
            {' '}
            and
            {' '}
            <strong>audio</strong>
            . If you&apos;re not comfortable, you may exit and return the study.
          </p>
          <p>Follow the steps below to grant screen and audio recording permissions.</p>

          <ol>
            <li>
              <strong>Click the button below</strong>
              {' '}
              to enable screen and audio recording.
              <Button type="button" onClick={screenCapturing ? stopCapture : startCapture} display="block" mt="sm">
                {screenCapturing ? 'Stop Recording' : 'Start Recording'}
              </Button>
              <video
                ref={recordVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '400px', border: '1px solid #ccc', marginTop: '1rem' }}
              />
              {error && <p style={{ color: 'red' }}>{error}</p>}
              <p><i>Note: Please make sure you are recording the correct tab or window. Otherwise, stop and re-share the correct one.</i></p>

            </li>
            <li>
              <strong>Speak</strong>
              {' '}
              into your microphone to check if audio is working.
              {(recordAudio && screenCapturing) ? <Box h={200} w={400} bd="1px solid #ccc"><RecordingAudioWaveform height={200} width={400} /></Box> : <Box h={200} w={400} bd="1px solid #ccc" />}
            </li>
          </ol>
          <strong>Note:</strong>
          <ul>
            <li>
              After we hear you say something, the
              {' '}
              <b>Continue</b>
              {' '}
              button will be enabled.
            </li>
            <li>Please do not close the window or screen recording until the entire study is completed.</li>
          </ul>
        </>
      ) : (
        <>
          {/* Record screen only */}
          <p>
            This study requires recording of your
            {' '}
            <strong>screen</strong>
            . If you&apos;re not comfortable, you may exit and return the study.
          </p>
          <strong>Click the button below</strong>
          {' '}
          to enable screen recording.
          <Button type="button" onClick={screenCapturing ? stopCapture : startCapture} display="block" mt="sm">
            {screenCapturing ? 'Stop Recording' : 'Start Recording'}
          </Button>
          <video
            ref={recordVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '400px', border: '1px solid #ccc', marginTop: '1rem' }}
          />
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <p><i>Note: Please make sure you are recording the correct tab or window. Otherwise, stop and re-share the correct one.</i></p>

          <strong>Note:</strong>
          <ul>
            <li>Please do not close the window or screen recording until the entire study is completed.</li>
          </ul>
        </>
      )}
    </Box>
  );
}

export default ScreenRecordingPermission;
