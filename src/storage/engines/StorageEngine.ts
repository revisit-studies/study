import { StoredAnswer } from '../../store/types';
import { ParticipantData } from '../types';


export abstract class StorageEngine {
  protected engine: string;
  protected connected = false;
  protected currentParticipantId: string | null = null;

  constructor(engine: string) {
    this.engine = engine;
  }
 
  isConnected() {
    return this.connected;
  }

  getEngine() {
    return this.engine;
  }

  abstract connect(): Promise<void>;

  abstract initializeStudyDb(studyId: string, config: object): Promise<void>;

  abstract initializeParticipantSession(participantId: string, sequence: string[]): Promise<ParticipantData>;
  abstract getParticipantSession(participantId: string): Promise<ParticipantData | null>;

  abstract getCurrentParticipantId(): Promise<string>;
  abstract clearCurrentParticipantId(): Promise<void>;

  abstract saveAnswer(currentStep: string, answer: StoredAnswer): Promise<void>;

  abstract setSequenceArray(latinSquare: string[][]): Promise<void>;
  abstract getSequenceArray(): Promise<string[][] | null>;
  abstract getSequence(): Promise<string[]>;

  abstract getAllParticpantsData(): Promise<ParticipantData[]>;
  abstract getParticipantData(): Promise<ParticipantData | null>;

  abstract nextParticipant(): Promise<ParticipantData>;
}
