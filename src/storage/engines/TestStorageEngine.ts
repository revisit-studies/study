// This file defines a test storage engine that extends the base StorageEngine class.
// This storage engine is used for testing purposes and does not implement any specific storage logic related to any backend.
// It holds it's data in an object and returns it when requested.
// Some methods do nothing, such as caching, since we cannot test caching in a test environment.

import {
  REVISIT_MODE, SequenceAssignment, StorageEngine, StorageObject, StorageObjectType,
} from './types';

export class TestStorageEngine extends StorageEngine {
  realtimeDatabase: Record<string, unknown> = {};

  storage: Record<string, unknown> = {};

  constructor() {
    super('test');
  }

  async connect() {
    // No connection needed for test storage engine
  }

  protected async _getFromStorage<T extends StorageObjectType>(prefix: string, type: T, studyId?: string) {
    const storageKey = `${this.collectionPrefix}${studyId || this.studyId}/${prefix}_${type}`;
    return this.storage[storageKey] as StorageObject<T>;
  }

  protected async _pushToStorage<T extends StorageObjectType>(prefix: string, type: T, objectToUpload: StorageObject<T>) {
    const storageKey = `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`;
    this.storage[storageKey] = objectToUpload;
  }

  protected async _deleteFromStorage<T extends StorageObjectType>(prefix: string, type: T) {
    const storageKey = `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`;
    delete this.storage[storageKey];
  }

  protected async _cacheStorageObject() {
    // Caching is not applicable in a test environment
  }

  protected async _setCurrentConfigHash(configHash: string) {
    const key = `${this.collectionPrefix}${this.studyId}/configHash`;
    this.realtimeDatabase[key] = configHash;
  }

  protected async _getCurrentConfigHash() {
    const key = `${this.collectionPrefix}${this.studyId}/configHash`;
    return this.realtimeDatabase[key] as string;
  }

  protected async _verifyStudyDatabase() {
    // No verification needed for test storage engine
  }

  async _setCompletedRealtime() {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    if (!this.realtimeDatabase[sequenceAssignmentPath]) {
      this.realtimeDatabase[sequenceAssignmentPath] = {};
    }
    const sequenceAssignments = this.realtimeDatabase[sequenceAssignmentPath] as Record<string, SequenceAssignment>;

    if (sequenceAssignments[this.currentParticipantId]) {
      sequenceAssignments[this.currentParticipantId].completed = new Date().getTime();
    } else {
      throw new Error('Participant sequence assignment not found');
    }
  }

  async _getSequence() {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    // Get modes
    const modes = await this.getModes(this.studyId);

    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    if (!this.realtimeDatabase[sequenceAssignmentPath]) {
      this.realtimeDatabase[sequenceAssignmentPath] = {};
    }
    let sequenceAssignments = this.realtimeDatabase[sequenceAssignmentPath] as Record<string, SequenceAssignment>;

    // Find all rejected documents
    const rejectedDocs = Object.entries(sequenceAssignments).filter(([_, doc]) => doc.rejected && !doc.claimed);
    if (rejectedDocs.length > 0) {
      const firstReject = rejectedDocs[0];
      const firstRejectTime = firstReject[1].timestamp;
      if (modes.dataCollectionEnabled) {
        // Make the sequence assignment document for the participant
        const participantSequenceAssignmentData: SequenceAssignment = {
          participantId: this.currentParticipantId,
          timestamp: firstRejectTime, // Use the timestamp of the first reject
          rejected: true,
          claimed: false,
          completed: null,
          createdTime: new Date().getTime(),
        };
        // Mark the first reject as claimed
        this.realtimeDatabase[firstReject[0]] = { ...firstReject[1], claimed: true };
        // Set the participant's sequence assignment document
        (this.realtimeDatabase[sequenceAssignmentPath] as Record<string, SequenceAssignment>)[this.currentParticipantId] = participantSequenceAssignmentData;
      }
    } else if (modes.dataCollectionEnabled) {
      const timestamp = new Date().getTime();
      const participantSequenceAssignmentData: SequenceAssignment = {
        participantId: this.currentParticipantId,
        timestamp,
        rejected: false,
        claimed: false,
        completed: null,
        createdTime: timestamp,
      };
      (this.realtimeDatabase[sequenceAssignmentPath] as Record<string, SequenceAssignment>)[this.currentParticipantId] = participantSequenceAssignmentData;
    }

    // Query all the intents to get a sequence and find our position in the queue
    sequenceAssignments = this.realtimeDatabase[sequenceAssignmentPath] as Record<string, SequenceAssignment>;
    const intents = Object.values(sequenceAssignments)
      .sort((a, b) => (a.timestamp as number) - (b.timestamp as number));

    // Get the latin square
    const sequenceArray = await this.getSequenceArray();
    if (!sequenceArray) {
      throw new Error('Latin square not initialized');
    }

    // Get the current row
    const intentIndex = intents.filter((intent) => !intent.rejected).findIndex(
      (intent) => intent.participantId === this.currentParticipantId,
    ) % sequenceArray.length;
    if (intentIndex === -1 && sequenceArray.length === 0) {
      throw new Error('Something really bad happened with sequence assignment');
    }
    const currentRow = sequenceArray[intentIndex];

    if (!currentRow) {
      throw new Error('Latin square is empty');
    }

    const creationSorted = intents.sort((a, b) => (a.createdTime as number) - (b.createdTime as number));

    const creationIndex = creationSorted.findIndex((intent) => intent.participantId === this.currentParticipantId) + 1;

    return { currentRow, creationIndex };
  }

  async initializeStudyDb(studyId: string) {
    this.studyId = studyId;
  }

  async getModes(studyId: string) {
    const key = `${this.collectionPrefix}${studyId}/modes`;
    if (!this.realtimeDatabase[key]) {
      this.realtimeDatabase[key] = {
        analyticsInterfacePubliclyAccessible: true,
        dataCollectionEnabled: true,
        revisitInterfacePubliclyAccessible: true,
      };
    }
    return this.realtimeDatabase[key] as Record<REVISIT_MODE, boolean>;
  }

  async setMode(studyId: string, mode: REVISIT_MODE, value: boolean) {
    const key = `${this.collectionPrefix}${studyId}/modes`;
    this.realtimeDatabase[key] = {
      ...(this.realtimeDatabase[key] as Record<REVISIT_MODE, boolean>),
      [mode]: value,
    };
  }

  async getAllParticipantIds() {
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    if (!this.realtimeDatabase[sequenceAssignmentPath]) {
      return [];
    }
    const sequenceAssignments = this.realtimeDatabase[sequenceAssignmentPath] as Record<string, SequenceAssignment>;
    return Object.keys(sequenceAssignments);
  }

  async _rejectParticipantRealtime(participantId: string) {
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    if (!this.realtimeDatabase[sequenceAssignmentPath]) {
      throw new Error('Sequence assignment not found');
    }
    const sequenceAssignments = this.realtimeDatabase[sequenceAssignmentPath] as Record<string, SequenceAssignment>;

    if (!sequenceAssignments[participantId]) {
      throw new Error(`Participant ${participantId} not found in sequence assignment`);
    }

    // Mark the participant as rejected
    sequenceAssignments[participantId].rejected = true;
  }

  async _getAudioUrl(task: string, participantId?: string) {
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }
    const storageKey = `${this.collectionPrefix}${this.studyId}/audio/${task}/${participantId || this.currentParticipantId}`;
    if (!this.storage[storageKey]) {
      throw new Error(`Audio for task ${task} and participant ${participantId || this.currentParticipantId} not found`);
    }
    // Get url for an in memory blob file
    const audioBlob = this.storage[storageKey] as Blob;
    return URL.createObjectURL(audioBlob);
  }

  async getParticipantsStatusCounts(studyId: string) {
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `${this.collectionPrefix}${studyId}/sequenceAssignment`;
    if (!this.realtimeDatabase[sequenceAssignmentPath]) {
      throw new Error('Sequence assignment not found');
    }
    const sequenceAssignments = this.realtimeDatabase[sequenceAssignmentPath] as Record<string, SequenceAssignment>;
    const sequenceAssignmentsData = Object.values(sequenceAssignments)
      .sort((a, b) => (a.timestamp as number) - (b.timestamp as number));

    const completed = sequenceAssignmentsData.filter((assignment) => assignment.completed && !assignment.rejected).length;
    const rejected = sequenceAssignmentsData.filter((assignment) => assignment.rejected).length;
    const inProgress = sequenceAssignmentsData.length - completed - rejected;
    const minTime = sequenceAssignmentsData.length > 0 ? sequenceAssignmentsData[0].timestamp : null;
    const maxTime = sequenceAssignmentsData.length > 0 ? sequenceAssignmentsData.at(-1)!.timestamp : null;

    return {
      completed,
      rejected,
      inProgress,
      minTime,
      maxTime,
    };
  }
}
