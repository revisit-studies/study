import { LocalStorageEngine } from '../../src/storage/engines/LocalStorageEngine';
import type { ParticipantDataWithStatus } from '../../src/storage/types';
import type { EditedText } from '../../src/analysis/individualStudy/thinkAloud/types';

const transcript: EditedText[] = Array.from({ length: 45 }, (_, index) => ({
  text: `Transcript row ${index + 1}`, transcriptMappingStart: index, transcriptMappingEnd: index,
  selectedTags: [], annotation: '',
}));
const participant: ParticipantDataWithStatus = {
  participantId: 'coding-participant', participantIndex: 1, participantConfigHash: 'coding-config',
  completed: true, rejected: false, stage: '', participantTags: [], searchParams: {},
  metadata: { userAgent: 'Firefox/130.0', language: 'en', resolution: {}, ip: null },
  sequence: { order: 'fixed', orderPath: 'root', components: ['task'], skip: [] },
  answers: {
    task_1: {
      identifier: 'task_1', componentName: 'task', trialOrder: '0', startTime: 1000, endTime: 2000,
      answer: {}, windowEvents: [], timedOut: false, incorrectAnswers: {}, helpButtonClickedCount: 0,
      parameters: {}, correctAnswer: [], optionOrders: {}, questionOrders: {},
    },
  },
};

// Only imported by the intercepted storage initializer in the browser test.
// Keep the actual editor, footer, ResizeObserver, and Mantine layout intact.
export async function initializeStorageEngine() {
  const engine = new LocalStorageEngine();
  let editedTranscript = structuredClone(transcript);
  Object.assign(engine, {
    getEngine: () => 'firebase',
    getAllParticipantsData: async () => [participant],
    getParticipantData: async () => participant,
    getCurrentConfigHash: async () => 'coding-config',
    getAllConfigsFromHash: async () => ({ 'coding-config': await fetch('/coding-scroll/config.json').then((response) => response.json()) }),
    getTranscription: async () => ({ results: transcript.map((line, index) => ({
      resultEndTime: `${(index + 1) / transcript.length}s`, languageCode: 'en',
      alternatives: [{ transcript: line.text, confidence: 1 }],
    })) }),
    getEditedTranscript: async () => structuredClone(editedTranscript),
    saveEditedTranscript: async (_id: string, _email: string, _task: string, lines: EditedText[]) => { editedTranscript = structuredClone(lines); },
    getAudio: async () => '/coding-scroll/audio.wav',
    getAudioUrl: async () => '/coding-scroll/audio.wav',
    getScreenRecording: async () => new URLSearchParams(window.location.search).has('warning') ? '/coding-scroll/audio.wav' : null,
    getWebcamRecording: async () => null,
    getProvenance: async () => null,
  });
  await engine.connect();
  await engine.initializeStudyDb('coding-scroll');
  await engine.saveTags([{ id: 'observation', name: 'Observation', color: '#228be6' }], 'text');
  return engine;
}
