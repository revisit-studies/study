import { NodeId } from '@trrack/core';
import { Firestore } from 'firebase/firestore';
import localforage from 'localforage';
import { StudyProvenance } from '../store/store';
import { StudyConfig } from '../parser/types';
import { StoredAnswer } from '../store/types';

export type LocalForage = typeof localforage;

export type ProvenanceStorage = {
  pid: string;
  connected: boolean;
  initialize(
    studyId: string,
    sessionId: string,
    trrack: StudyProvenance
  ): Promise<null | {
    createNew(): Promise<unknown>;
  }>;
  firestore: Firestore;
  startFirestore: () => void;
  saveNewProvenanceNode(trrack: StudyProvenance): void;
  saveStudyConfig(config: StudyConfig, studyId: string): Promise<{path: string, order: string[]}[] | null>;
  completeSession(sessionId: string): Promise<void>;
  abandonSession(sessionId: string): Promise<void>;
};

type FsTimestamp = {
  seconds: number;
  nanoseconds: number;
};

export type FsParticipant = {
  createdOn: FsTimestamp;
};

export type FsStudy = {
  createdOn: FsTimestamp;
};

type FinalSessionStatus = 'abandoned' | 'completed';
type SessionStatus = FinalSessionStatus | 'started' | 'restored';

export type FsSession = {
  studyId: string;
  pid: string;
  lastSavedNode: NodeId;
  lastUpdatedAt: FsTimestamp;
  current: NodeId;
  root: NodeId;
  status: {
    history: Array<{
      status: SessionStatus;
      timestamp: FsTimestamp;
    }>;
    endStatus: {
      status: FinalSessionStatus;
      timestamp: FsTimestamp;
    } | null;
  };
};

export interface ParticipantData {
  sequence: string[],
  answers: Record<string, StoredAnswer>,
}
