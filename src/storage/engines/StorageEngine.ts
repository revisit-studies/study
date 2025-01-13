import { User } from '@firebase/auth';
import { Timestamp } from 'firebase/firestore';
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

  abstract getParticipantData(participantid?: string): Promise<ParticipantData | null>;

  abstract getParticipantTags(): Promise<string[]>;

  /**
   * This function adds tags to the participant. It ensures that the tags are unique, so if a tag is already present, it will not be added again.
   * @param tags An array of tags to add to the participant
   */
  abstract addParticipantTags(tags: string[]): Promise<void>;

  abstract removeParticipantTags(tags: string[]): Promise<void>;

  abstract nextParticipant(): Promise<void>;

  abstract verifyCompletion(answers: Record<string, StoredAnswer>): Promise<boolean>;

  abstract validateUser(user: UserWrapped | null, refresh?: boolean): Promise<boolean>;

  abstract saveAudio(audioStream: MediaRecorder, taskName: string): Promise<void>;

  abstract rejectParticipant(studyId: string, participantID: string, reason: string): Promise<void>;

  abstract rejectCurrentParticipant(studyId: string, reason: string): Promise<void>;

  abstract setMode(studyId: string, mode: REVISIT_MODE, value: boolean): Promise<void>;

  abstract getAudio(task: string, participantId?: string): Promise<string | undefined>;

  abstract getModes(studyId: string): Promise<Record<REVISIT_MODE, boolean>>;

  abstract getParticipantsStatusCounts(studyId: string): Promise<{completed: number; rejected: number; inProgress: number; minTime: Timestamp | number | null; maxTime: Timestamp | number | null}>;
}
