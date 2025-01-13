import {
  Center, Stack, Text,
} from '@mantine/core';
import {
  useEffect,
} from 'react';
import { StimulusParams } from '../../../../store/types';
import RecordingAudioWaveform from '../../../../components/interface/RecordingAudioWaveform';

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
    <Center style={{ height: '70%', width: '100%' }}>
      <Stack>
        <Text ta="center">
          Please allow us to access your microphone. There may be a popup in your browser window asking for access, click accept.
        </Text>
        <Text ta="center">
          Once we can confirm that your microphone is on and we hear you say something, the continue button will become available.
        </Text>
        <Text ta="center" style={{ fontWeight: 700 }}>
          If you are not comfortable or able to speak English during this study, please return the study.
        </Text>
        <Center><RecordingAudioWaveform height={200} width={400} /></Center>
      </Stack>
    </Center>
  );
}

export default AudioTest;
