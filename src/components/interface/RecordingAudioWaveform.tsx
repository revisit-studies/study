import {
  Box,
} from '@mantine/core';

import {
  useCallback, useRef,
} from 'react';
import { WaveForm, WaveSurfer } from 'wavesurfer-react';
import WaveSurferRef from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record';

export default function RecordingAudioWaveform({ width = 70, height = 36 }: {width?: number, height?: number}) {
  const wavesurferRef = useRef<WaveSurferRef | null>(null);

  const handleWSMount = useCallback(
    (waveSurfer: WaveSurferRef | null) => {
      wavesurferRef.current = waveSurfer;

      if (wavesurferRef.current) {
        const record = wavesurferRef.current.registerPlugin(RecordPlugin.create({ scrollingWaveform: true, renderRecordedAudio: false } as never));
        record.startRecording();
        wavesurferRef.current.setOptions({ height, waveColor: '#FA5252' });
      }
    },
    [],
  );

  return (
    <Box id="waveformDiv" style={{ width: `${width}px`, height: `${height}px` }}>
      <WaveSurfer onMount={handleWSMount} plugins={[]} container="#waveformDiv" height={height}>
        <WaveForm id="waveform" height={height} />
      </WaveSurfer>
    </Box>
  );
}
