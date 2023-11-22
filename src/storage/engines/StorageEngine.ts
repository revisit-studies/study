import { StoredAnswer } from '../../store/types';
import { ParticipantData } from '../types';

export type StorageEngineConstants = {
  MODE: 'prod' | 'dev',
  PID_KEY: '__pid',
  CONN_CHECK: string,
  PARTICIPANTS: string,
  STUDIES: string,
  SESSIONS: string,
  TRRACKS: string,
  NODES: string,
  TRRACK: string,
  RECAPTCHAV3TOKEN: string,
}

export abstract class StorageEngine {
  protected engine: string;
  protected connected = false;
  protected constants: StorageEngineConstants;
  protected currentParticipantId: string | null = null;

  constructor(engine: string, constants: StorageEngineConstants) {
    this.engine = engine;
    this.constants = constants;
  }
 
  abstract isConnected(): boolean;

  getEngine() {
    return this.engine;
  }

  abstract connect(): Promise<void>;

  abstract initializeStudyDb(studyId: string, config: object): Promise<void>;

  abstract initializeParticipantSession(participantId: string, sequence: string[]): Promise<ParticipantData>;
  abstract getParticipantSession(participantId: string): Promise<ParticipantData | null>;
  abstract finalizeParticipantSession(): Promise<void>;

  abstract getCurrentParticipantId(): Promise<string>;
  abstract clearCurrentParticipantId(): Promise<void>;

  abstract saveAnswer(currentStep: string, answer: StoredAnswer): Promise<void>;

  abstract setSequenceArray(latinSquare: string[][]): Promise<void>;
  abstract getSequenceArray(): Promise<string[][] | null>;
  abstract getSequence(): Promise<string[]>;

  abstract getAllParticpantsData(studyId: string): Promise<ParticipantData[]>;
  abstract getParticipantData(studyId: string): Promise<ParticipantData | null>;
}
