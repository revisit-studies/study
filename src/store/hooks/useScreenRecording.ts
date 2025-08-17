import { useCallback, useRef, useState } from 'react';
import { useStudyConfig } from './useStudyConfig';

/**
 * Capture screen and audio
 * If screen and audio capture in mentioned in the ui config,
 * both are recorded at the same time
 */
export function useScreenRecording() {
  const studyConfig = useStudyConfig();

  const { recordScreen, recordScreenFPS, recordAudio } = studyConfig.uiConfig;

  const recordVideoRef = useRef<HTMLVideoElement>(null);
  const [screenRecordingError, setRecordingError] = useState<string | null>(null);
  const [screenRecording, setScreenRecording] = useState(false);
  const [screenWithAudioRecording, setScreenWithAudioRecording] = useState(false);

  const [screenRecordingConfirmed, setScreenRecordingConfirmed] = useState(false);

  const screenRecordingStream = useRef<MediaRecorder | null>(null); // combined stream

  const [pageTitle] = useState(document.title);

  const stopScreenCapture = useCallback(() => {
    const stream = recordVideoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((track) => track.stop());
    if (recordVideoRef.current) {
      recordVideoRef.current.srcObject = null;
    }
    setScreenRecording(false);
    setScreenWithAudioRecording(false);
  }, []);

  const startScreenCapture = useCallback(() => {
    const captureFn = async () => {
      document.title = `RECORD THIS TAB: ${pageTitle}`;

      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser', ...(recordScreenFPS ? { frameRate: { ideal: recordScreenFPS } } : {}) },
          audio: false,
        });

        const micStream = recordAudio ? await navigator.mediaDevices.getUserMedia({
          audio: recordAudio,
          video: false,
        }) : null;

        const combinedStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...(micStream?.getAudioTracks() ?? []),
        ]);

        if (recordVideoRef.current) {
          recordVideoRef.current.srcObject = combinedStream;
          recordVideoRef.current.play();
        }

        combinedStream.getTracks().forEach((track) => {
          track.addEventListener('ended', () => {
            stopScreenCapture();
          });
        });

        const mediaRecorder = new MediaRecorder(combinedStream);
        screenRecordingStream.current = mediaRecorder;

        mediaRecorder.start();

        setScreenRecording(true);
        setScreenWithAudioRecording(!!recordAudio);
        setRecordingError(null);
      } catch (err) {
        console.error('Error accessing screen:', err);
        setRecordingError('Recording permission denied or not supported.');
      } finally {
        document.title = pageTitle;
      }
    };
    if (recordScreen) {
      captureFn();
    }
  }, [pageTitle, recordAudio, recordScreen, recordScreenFPS, stopScreenCapture]);

  const confirmScreenRecording = useCallback(() => {
    if (screenRecording) {
      setScreenRecordingConfirmed(true);
    }
  }, [screenRecording]);

  return {
    recordVideoRef,
    recordScreen,
    recordAudio,
    startScreenCapture,
    stopScreenCapture,
    screenRecordingError,
    screenRecording,
    screenRecordingConfirmed,
    confirmScreenRecording,
    screenRecordingStream,
    screenWithAudioRecording,
  };
}
