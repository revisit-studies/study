import { NodeId } from '@trrack/core';
import { Firestore } from 'firebase/firestore';
import localforage from 'localforage';
import { StudyProvenance } from '../store';

export type LocalForage = typeof localforage;

export type ProvenanceStorage = {
  pid: string;
  initialize(
    studyId: string,
    sessionId: string,
    trrack: StudyProvenance
  ): Promise<null | {
    createNew(): Promise<any>;
    restoreSession(): Promise<any>;
  }>;
  store: Firestore;
  saveNewProvenanceNode(trrack: StudyProvenance): void;
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
