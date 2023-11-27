import { StoredAnswer } from '../../store/types';
import { ParticipantData } from '../types';
import { StorageEngineConstants, StorageEngine } from './StorageEngine';

export class FirebaseStorageEngine extends StorageEngine {
  initializeStudyDb(studyId: string, config: object): Promise<void> {
    throw new Error('Method not implemented.');
  }
  initializeParticipantSession(participantId: string, sequence: string[]): Promise<ParticipantData> {
    throw new Error('Method not implemented.');
  }
  getParticipantSession(participantId: string): Promise<ParticipantData | null> {
    throw new Error('Method not implemented.');
  }
  finalizeParticipantSession(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getCurrentParticipantId(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  clearCurrentParticipantId(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  saveAnswer(currentStep: string, answer: StoredAnswer): Promise<void> {
    throw new Error('Method not implemented.');
  }
  setSequenceArray(latinSquare: string[][]): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getSequenceArray(): Promise<string[][] | null> {
    throw new Error('Method not implemented.');
  }
  getSequence(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  getAllParticpantsData(): Promise<ParticipantData[]> {
    throw new Error('Method not implemented.');
  }
  getParticipantData(): Promise<ParticipantData | null> {
    throw new Error('Method not implemented.');
  }
  constructor(constants: StorageEngineConstants) {
    super('firebase', constants);
  }

  // TODO: Implement
  connect(): Promise<void> {
    return Promise.resolve();
  }

  isConnected(): boolean {
    return false;
  }
}