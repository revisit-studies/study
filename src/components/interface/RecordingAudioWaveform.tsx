import { Flex } from '@mantine/core';
import { useRef, useEffect, useState } from 'react';

export function RecordingAudioWaveform({
  width = 60,
  height = 36,
  fps = 30,
  fftSize = 256,
  barColor = '#FA5252',
  barWidth = 2,
}: {
  width?: number;
  height?: number;
  fps?: number;
  fftSize?: 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384;
  barColor?: string;
  barWidth?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameIdRef = useRef<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let lastTime = 0;
    const frameInterval = 1000 / fps;
    const draw = (now: number) => {
      animationFrameIdRef.current = requestAnimationFrame(draw);

      // Limit framerate
      if (now - lastTime < frameInterval) return;
      lastTime = now;

      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      // Compute normalized max amplitude (-1 to 1)
      const max = Math.max(...dataArray) / 128.0 - 1.0;

      // Scroll canvas left by barWidth / 2 pixels
      const imageData = ctx.getImageData(barWidth / 2, 0, canvas.width - barWidth / 2, canvas.height);
      ctx.putImageData(imageData, 0, 0);

      // Clear the rightmost column to make space for the new bar
      ctx.clearRect(canvas.width - barWidth, 0, barWidth, canvas.height);

      // Map audio amplitude to vertical positions on the canvas
      const yMax = (1 - max) * (canvas.height / 2);

      ctx.beginPath();
      ctx.moveTo(canvas.width - barWidth - 10, canvas.height / 2);
      ctx.lineTo(canvas.width - barWidth, canvas.height / 2);
      ctx.moveTo(canvas.width - barWidth, canvas.height - yMax);
      ctx.lineTo(canvas.width - barWidth, yMax);
      ctx.strokeStyle = barColor;
      ctx.lineWidth = barWidth;
      ctx.stroke();
    };

    const setupAudio = async () => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const context = new window.AudioContext();

        audioContextRef.current = context;

        const source = context.createMediaStreamSource(stream);
        sourceRef.current = source;

        const analyser = context.createAnalyser();
        analyserRef.current = analyser;

        analyser.fftSize = fftSize;
        source.connect(analyser);

        animationFrameIdRef.current = requestAnimationFrame(draw);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        if (err instanceof Error) {
          setError(`Error accessing microphone: ${err.message}. Please grant permission.`);
        } else {
          setError('An unknown error occurred while accessing the microphone.');
        }
      }
    };

    setupAudio();

    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
      if (analyserRef.current) analyserRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();

      // Stop microphone track
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Close the AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [width, height, fps, fftSize, barColor, barWidth]);

  return (
    <Flex>
      {error && <p style={{ color: 'red', maxWidth: `${width}px` }}>{error}</p>}
      <canvas ref={canvasRef} />
    </Flex>
  );
}
