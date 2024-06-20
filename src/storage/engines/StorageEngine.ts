import { User } from '@firebase/auth';
import { StudyConfig } from '../../parser/types';
import { ParticipantMetadata, Sequence, StoredAnswer } from '../../store/types';
import { ParticipantData } from '../types';

export interface StoredUser {
  email: string,
  uid: string | null,
}

export interface LocalStorageUser {
  name: string,
  email: string,
  uid: string,
}

export type UserOptions = User | LocalStorageUser | null;

export interface UserWrapped {
  user: UserOptions,
  determiningStatus: boolean,
  isAdmin: boolean,
  adminVerification:boolean
}

export type REVISIT_MODE = 'dataCollectionEnabled' | 'studyNavigatorEnabled' | 'analyticsInterfacePubliclyAccessible';

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

  abstract initializeParticipantSession(studyId: string, searchParams: Record<string, string>, config: StudyConfig, metadata: ParticipantMetadata, urlParticipantId?: string): Promise<ParticipantData>;

  abstract getCurrentConfigHash(): Promise<string>;

  abstract getAllConfigsFromHash(hashes: string[], studyId: string): Promise<Record<string, StudyConfig>>;

  abstract getCurrentParticipantId(urlParticipantId?: string): Promise<string>;

  abstract clearCurrentParticipantId(): Promise<void>;

  abstract saveAnswers(answers: Record<string, StoredAnswer>): Promise<void>;

  abstract setSequenceArray(latinSquare: Sequence[]): Promise<void>;

  abstract getSequenceArray(): Promise<Sequence[] | null>;

  abstract getSequence(): Promise<Sequence>;

  abstract getAllParticipantsData(): Promise<ParticipantData[]>;

  abstract getAllParticipantsDataByStudy(studyId:string): Promise<ParticipantData[]>;

  abstract getParticipantData(): Promise<ParticipantData | null>;

  abstract nextParticipant(): Promise<void>;

  abstract verifyCompletion(answers: Record<string, StoredAnswer>): Promise<boolean>;

  abstract validateUser(user: UserWrapped | null): Promise<boolean>;

  abstract rejectParticipant(studyId: string, participantID: string): Promise<void>;

  abstract setMode(studyId: string, mode: REVISIT_MODE, value: boolean): Promise<void>;

  abstract getModes(studyId: string): Promise<Record<REVISIT_MODE, boolean>>;
}
