import localforage from 'localforage';
import {
  REVISIT_MODE, SequenceAssignment, SnapshotDocContent, StorageEngine, StorageObject, StorageObjectType,
} from './types';

export class LocalStorageEngine extends StorageEngine {
  private studyDatabase = localforage.createInstance({
    name: 'revisit',
  });

  constructor(testing: boolean = false) {
    super('localStorage', testing);
  }

  protected async _getFromStorage<T extends StorageObjectType>(prefix: string, type: T, studyId?: string) {
    const storageKey = `${this.collectionPrefix}${studyId || this.studyId}/${prefix}_${type}`;
    const storedObject = await this.studyDatabase.getItem<StorageObject<T>>(storageKey);
    return storedObject;
  }

  protected async _pushToStorage<T extends StorageObjectType>(prefix: string, type: T, objectToUpload: StorageObject<T>) {
    await this.verifyStudyDatabase();
    const storageKey = `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`;
    await this.studyDatabase.setItem(storageKey, objectToUpload);
  }

  protected async _deleteFromStorage<T extends StorageObjectType>(prefix: string, type: T) {
    await this.verifyStudyDatabase();
    const storageKey = `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`;
    await this.studyDatabase.removeItem(storageKey);
  }

  protected async _cacheStorageObject() {
    // Caching is not applicable in a local storage environment
  }

  protected async _verifyStudyDatabase() {
    if (!this.studyDatabase || !this.studyId) {
      throw new Error('Study database not initialized');
    }
  }

  protected async _getCurrentConfigHash() {
    await this.verifyStudyDatabase();
    const key = `${this.collectionPrefix}${this.studyId}/configHash`;
    return await this.studyDatabase.getItem<string>(key) || null;
  }

  protected async _setCurrentConfigHash(configHash: string) {
    await this.verifyStudyDatabase();
    const key = `${this.collectionPrefix}${this.studyId}/configHash`;
    await this.studyDatabase.setItem(key, configHash);
  }

  protected async _getAllSequenceAssignments(studyId: string) {
    const sequenceAssignmentPath = `${this.collectionPrefix}${studyId}/sequenceAssignment`;
    const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath);
    if (!sequenceAssignments) {
      return [];
    }
    return Object.values(sequenceAssignments).sort((a, b) => a.timestamp - b.timestamp);
  }

  protected async _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment) {
    await this.verifyStudyDatabase();
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }
    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};
    sequenceAssignments[participantId] = sequenceAssignment;
    await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
  }

  protected async _completeCurrentParticipantRealtime() {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};

    if (sequenceAssignments[this.currentParticipantId]) {
      sequenceAssignments[this.currentParticipantId] = {
        ...sequenceAssignments[this.currentParticipantId],
        completed: new Date().getTime(),
      };
    } else {
      throw new Error('Participant sequence assignment not found');
    }
    await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
  }

  protected async _rejectParticipantRealtime(participantId: string) {
    await this.verifyStudyDatabase();
    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};

    const participantSequenceAssignment = sequenceAssignments[participantId];

    // If this was a claimed sequence assignment, we need to mark it as available again
    // Find the sequence assignment that was claimed
    const claimedAssignmentData = Object.values(sequenceAssignments).find((assignment) => assignment.claimed && assignment.timestamp === participantSequenceAssignment.timestamp);
    if (participantSequenceAssignment && claimedAssignmentData) {
      // Mark the claimed assignment as available again
      claimedAssignmentData.claimed = false;
      claimedAssignmentData.rejected = true; // Mark it as rejected
      await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);

      // Delete the participant's sequence assignment
      // delete sequenceAssignments[participantId];
      sequenceAssignments[participantId] = {
        ...participantSequenceAssignment,
        timestamp: new Date().getTime(),
        rejected: true,
      };
      await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
      return;
    }

    // Handle the original participant's sequence assignment
    if (participantSequenceAssignment) {
      participantSequenceAssignment.rejected = true;
      await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
    }
  }

  protected async _undoRejectParticipantRealtime(participantId: string) {
    await this.verifyStudyDatabase();
    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};

    const participantSequenceAssignment = sequenceAssignments[participantId];
    if (participantSequenceAssignment) {
      participantSequenceAssignment.rejected = false;
      await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
    }
  }

  protected async _claimSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment) {
    await this.verifyStudyDatabase();
    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};
    if (sequenceAssignments[participantId]) {
      sequenceAssignments[participantId] = {
        ...sequenceAssignment,
        claimed: true,
      };
      await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
    } else {
      throw new Error(`Sequence assignment for participant ${participantId} not found`);
    }
  }

  async initializeStudyDb(studyId: string) {
    // Create or retrieve database for study
    this.studyId = studyId;
  }

  async connect() {
    this.connected = true;
  }

  async getModes(studyId: string) {
    const key = `${this.collectionPrefix}${studyId}/modes`;

    // Get the modes
    const modes = await this.studyDatabase.getItem(key) as Record<REVISIT_MODE, boolean> | null;
    if (modes) {
      return modes;
    }

    // Else, set and return defaults
    const defaults: Record<REVISIT_MODE, boolean> = {
      dataCollectionEnabled: true,
      studyNavigatorEnabled: true,
      analyticsInterfacePubliclyAccessible: true,
    };
    this.studyDatabase.setItem(key, defaults);
    return defaults;
  }

  async setMode(studyId: string, mode: REVISIT_MODE, value: boolean) {
    const key = `${this.collectionPrefix}${studyId}/modes`;

    // Get the modes
    const modes = await this.studyDatabase.getItem(key) as Record<REVISIT_MODE, boolean> | null;
    if (!modes) {
      throw new Error('Modes not initialized');
    }

    // Set the mode
    modes[mode] = value;
    this.studyDatabase.setItem(key, modes);
  }

  protected async _getAudioUrl(task: string, participantId?: string) {
    await this.verifyStudyDatabase();
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }
    const audioBlob = await this._getFromStorage(`audio/${participantId || this.currentParticipantId}`, task);
    if (!audioBlob) {
      throw new Error(`Audio for task ${task} and participant ${participantId || this.currentParticipantId} not found`);
    }
    return URL.createObjectURL(audioBlob);
  }

  protected async _getScreenRecordingUrl(task: string, participantId?: string) {
    await this.verifyStudyDatabase();
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }
    const screenRecordingBlob = await this._getFromStorage(`screenRecording/${participantId || this.currentParticipantId}`, task);
    if (!screenRecordingBlob) {
      throw new Error(`ScreenRecording for task ${task} and participant ${participantId || this.currentParticipantId} not found`);
    }
    return URL.createObjectURL(screenRecordingBlob);
  }

  protected async _testingReset(studyId: string) {
    if (!studyId) {
      throw new Error('Study ID is required for reset');
    }
    // Clear the entire study database
    const keys = await this.studyDatabase.keys();
    const studyKeys = keys.filter((key) => key.startsWith(`${this.collectionPrefix}${studyId}/`));
    await Promise.all(studyKeys.map((key) => this.studyDatabase.removeItem(key)));

    await super.__testingReset();
  }

  async getSnapshots(studyId: string) {
    const snapshotsKey = `${this.collectionPrefix}${studyId}/snapshots`;
    const snapshotsData = await this.studyDatabase.getItem<SnapshotDocContent>(snapshotsKey);
    return snapshotsData || {};
  }

  protected async _directoryExists(path: string) {
    const keys = await this.studyDatabase.keys();
    return keys.some((key) => key.startsWith(path));
  }

  protected async _copyDirectory(source: string, target: string) {
    const keys = await this.studyDatabase.keys();
    const sourceKeys = keys.filter((key) => key.startsWith(source));
    const copyPromises = sourceKeys.map(async (key) => {
      if (key.endsWith('/snapshots') || key.endsWith('modes') || key.endsWith('configHash') || key.endsWith('currentParticipantId')) {
        // Skip copying the snapshots file
        return;
      }
      const value = await this.studyDatabase.getItem(key);
      const newKey = key.replace(source, target);
      await this.studyDatabase.setItem(newKey, value);
    });
    await Promise.all(copyPromises);
  }

  protected async _deleteDirectory(path: string) {
    const keys = await this.studyDatabase.keys();
    const targetKeys = keys.filter((key) => key.startsWith(path) && !key.includes('snapshots'));
    const deletePromises = targetKeys.map((key) => this.studyDatabase.removeItem(key));
    await Promise.all(deletePromises);
  }

  protected async _copyRealtimeData(source: string, target: string) {
    // Since the logic is the same, we'll use the same method as copying a directory
    await this._copyDirectory(source, target);
  }

  protected async _deleteRealtimeData(path: string) {
    // Since the logic is the same, we'll use the same method as deleting a directory
    await this._deleteDirectory(path);
  }

  protected async _addDirectoryNameToSnapshots(directoryName: string, studyId: string) {
    await this.verifyStudyDatabase();
    const metadataKey = `${this.collectionPrefix}${studyId}/snapshots`;
    const metadata = await this.studyDatabase.getItem<SnapshotDocContent>(metadataKey) || {};
    if (!metadata[directoryName]) {
      metadata[directoryName] = { name: directoryName };
      await this.studyDatabase.setItem(metadataKey, metadata);
    }
  }

  protected async _removeDirectoryNameFromSnapshots(directoryName: string, studyId: string) {
    await this.verifyStudyDatabase();
    const snapshotsKey = `${this.collectionPrefix}${studyId}/snapshots`;
    const snapshots = await this.studyDatabase.getItem<SnapshotDocContent>(snapshotsKey) || {};
    if (snapshots[directoryName]) {
      delete snapshots[directoryName];
      await this.studyDatabase.setItem(snapshotsKey, snapshots);
    }
  }

  protected async _changeDirectoryNameInSnapshots(key: string, newName: string, studyId: string) {
    await this.verifyStudyDatabase();
    const snapshotsKey = `${this.collectionPrefix}${studyId}/snapshots`;
    const snapshots = await this.studyDatabase.getItem<SnapshotDocContent>(snapshotsKey) || {};
    if (snapshots[key]) {
      snapshots[key] = { name: newName };
      await this.studyDatabase.setItem(snapshotsKey, snapshots);
    } else {
      throw new Error(`Snapshot with name ${key} does not exist`);
    }
  }
}
