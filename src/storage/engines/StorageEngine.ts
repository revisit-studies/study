import { DocumentData, DocumentReference } from 'firebase/firestore';
import { StudyConfig } from '../../parser/types';
import { Sequence, StoredAnswer } from '../../store/types';
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

  abstract initializeStudyDb(studyId: string, config: StudyConfig): Promise<void>;

  abstract initializeParticipantSession(searchParams: Record<string, string>, config: StudyConfig, urlParticipantId?: string): Promise<ParticipantData>;

  abstract getCurrentParticipantId(urlParticipantId?: string): Promise<string>;

  abstract clearCurrentParticipantId(): Promise<void>;

  abstract saveAnswer(identifier: string, answer: StoredAnswer): Promise<void>;

  abstract setSequenceArray(latinSquare: Sequence[]): Promise<void>;

  abstract getSequenceArray(): Promise<Sequence[] | null>;

  abstract getSequence(): Promise<Sequence>;

  abstract getAllParticipantsData(): Promise<ParticipantData[]>;

  abstract getParticipantData(): Promise<ParticipantData | null>;

  abstract nextParticipant(config: StudyConfig): Promise<ParticipantData>;

  abstract verifyCompletion(answers: Record<string, StoredAnswer>): Promise<boolean>;

  abstract getUserManagementData(key: string) : Promise<Record<string, DocumentData> | null>;

  abstract editUserManagementAdmins(adminUsersList: Array<string>) : Promise<void>;
}
