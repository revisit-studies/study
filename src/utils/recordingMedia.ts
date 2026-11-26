export function createRecordingMediaRecorder(stream: MediaStream) {
  const hasVideo = stream.getVideoTracks().length > 0;
  const hasAudio = stream.getAudioTracks().length > 0;
  const mimeType = hasVideo
    ? `video/webm;codecs=vp8${hasAudio ? ',opus' : ''}`
    : hasAudio ? 'audio/webm;codecs=opus' : undefined;

  if (mimeType && typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mimeType)) {
    return new MediaRecorder(stream, { mimeType });
  }
  return new MediaRecorder(stream);
}
