import {
  Box,
} from '@mantine/core';

import {
  useCallback, useRef,
} from 'react';
import { WaveForm, WaveSurfer } from 'wavesurfer-react';
import WaveSurferRef from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record';

export default function RecordingAudioWaveform({ width = 70, height = 50 }: {width?: number, height?: number}) {
  const wavesurferRef = useRef<WaveSurferRef | null>(null);

  const handleWSMount = useCallback(
    (waveSurfer: WaveSurferRef | null) => {
      wavesurferRef.current = waveSurfer;

      if (wavesurferRef.current) {
        const record = wavesurferRef.current.registerPlugin(RecordPlugin.create({ scrollingWaveform: true, renderRecordedAudio: false } as never));
        record.startRecording();
        wavesurferRef.current.setOptions({ height: 50, waveColor: '#FA5252' });
      }
    },
    [],
  );

  return (
    <Box style={{ width: `${width}px`, height: `${height}px` }}>
      <WaveSurfer onMount={handleWSMount} plugins={[]} container="waveform">
        <WaveForm id="waveform" />
      </WaveSurfer>
    </Box>
  );
}
