import {
  Box, Title,
} from '@mantine/core';
import {
  useEffect,
} from 'react';
import { StimulusParams } from '../../../../store/types';
import { RecordingAudioWaveform } from '../../../../components/interface/RecordingAudioWaveform';

export function AudioTest({ setAnswer }: StimulusParams<undefined>) {
  useEffect(() => {
    const _stream = navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    _stream.then((stream) => {
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
            setAnswer({
              status: true,
              provenanceGraph: undefined,
              answers: {
                audioTest: true,
              },
            });
          }
        }

        window.requestAnimationFrame(detectSound);
      };

      window.requestAnimationFrame(detectSound);
    });
  }, [setAnswer]);

  return (
    <Box p="md">
      <Title order={1} size="h2">
        Audio Recording Permission
      </Title>

      <p>
        This study requires recording of your
        {' '}
        <strong>audio</strong>
        . If you&apos;re not comfortable, you may exit and return the study.
      </p>
      <p>Follow the steps below to grant microphone access and confirm that your audio is working.</p>

      <ol>
        <li>
          <strong>Please allow us to access your microphone.</strong>
          {' '}
          There may be a popup in your browser window asking for access. Click allow to continue.
        </li>
        <li>
          <strong>Speak</strong>
          {' '}
          into your microphone to check if audio is working.
          <Box h={200} w={400} bd="1px solid #ccc" mt="sm">
            <RecordingAudioWaveform height={200} width={400} />
          </Box>
        </li>
      </ol>

      <strong>Note:</strong>
      <ul>
        <li>
          Once we can confirm that your microphone is on and we hear you say something, the
          {' '}
          <b>Continue</b>
          {' '}
          button will become available.
        </li>
        <li>If you are not comfortable or able to speak English during this study, please return the study.</li>
      </ul>
    </Box>
  );
}

export default AudioTest;
