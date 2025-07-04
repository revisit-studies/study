import {
  REVISIT_MODE, SequenceAssignment, StorageEngine, StorageObject, StorageObjectType,
} from './types';

export class SupabaseStorageEngine extends StorageEngine {
  protected _getFromStorage<T extends StorageObjectType>(prefix: string, type: T, studyId?: string): Promise<StorageObject<T> | null> {
    throw new Error('Method not implemented.');
  }

  protected _pushToStorage<T extends StorageObjectType>(prefix: string, type: T, objectToUpload: StorageObject<T>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected _deleteFromStorage<T extends StorageObjectType>(prefix: string, type: T): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected _cacheStorageObject<T extends StorageObjectType>(prefix: string, type: T): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected _verifyStudyDatabase(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected _getCurrentConfigHash(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  protected _setCurrentConfigHash(configHash: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected _getAllSequenceAssignments(studyId: string): Promise<Record<string, SequenceAssignment>> {
    throw new Error('Method not implemented.');
  }

  protected _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected _completeCurrentParticipantRealtime(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected _rejectParticipantRealtime(participantId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected _claimSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment): Promise<void> {
    throw new Error('Method not implemented.');
  }

  initializeStudyDb(studyId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  connect(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getModes(studyId: string): Promise<Record<REVISIT_MODE, boolean>> {
    throw new Error('Method not implemented.');
  }

  setMode(studyId: string, mode: REVISIT_MODE, value: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }

  protected _getAudioUrl(task: string, participantId?: string): Promise<string | null> {
    throw new Error('Method not implemented.');
  }
}
