import localforage from 'localforage';
import {
  StageAllocation, getStageAllocationFromAssignments, REVISIT_MODE, RuntimeStudySettings, SequenceAssignment, SequenceAssignmentAllocation, SnapshotDocContent, StorageEngine, StorageObject, StorageObjectType, cleanupModes,
} from './types';
import { SnapshotParticipantCounts } from './utils/snapshotParticipantCounts';

const localAllocationLocks = new Map<string, Promise<void>>();

async function withLocalAllocationLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = localAllocationLocks.get(key) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  localAllocationLocks.set(key, queued);
  await previous;

  try {
    return await operation();
  } finally {
    release();
    if (localAllocationLocks.get(key) === queued) {
      localAllocationLocks.delete(key);
    }
  }
}

export class LocalStorageEngine extends StorageEngine {
  private static lockChains = new Map<string, Promise<void>>();

  private studyDatabase = localforage.createInstance({
    name: 'revisit',
  });

  protected participantStore = this.studyDatabase;

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

  public async getAllSequenceAssignments(studyId: string) {
    const sequenceAssignmentPath = `${this.collectionPrefix}${studyId}/sequenceAssignment`;
    const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath);
    if (!sequenceAssignments) {
      return [];
    }
    return Object.values(sequenceAssignments).sort((a, b) => a.timestamp - b.timestamp);
  }

  public async getSequenceAssignment(studyId: string, participantId: string) {
    const key = `${this.collectionPrefix}${studyId}/sequenceAssignment`;
    const assignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(key);
    return assignments?.[participantId] ?? null;
  }

  protected async _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment) {
    await this.verifyStudyDatabase();
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }
    await withLocalAllocationLock(`${this.collectionPrefix}${this.studyId}/sequenceAssignment`, async () => {
      const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
      const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};
      sequenceAssignments[participantId] = sequenceAssignment;
      await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
    });
  }

  protected async _allocateSequenceAssignment(
    participantId: string,
    sequenceAssignment: SequenceAssignment,
  ): Promise<SequenceAssignmentAllocation> {
    await this.verifyStudyDatabase();
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    return withLocalAllocationLock(sequenceAssignmentPath, async () => {
      const assignmentsByParticipant = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(
        sequenceAssignmentPath,
      ) || {};
      const existingAssignment = assignmentsByParticipant[participantId];
      const assignments = Object.values(assignmentsByParticipant);

      if (existingAssignment && !existingAssignment.rejected) {
        const sequenceIndex = existingAssignment.sequenceIndex
          ?? assignments.filter((assignment) => !assignment.rejected)
            .sort((a, b) => a.timestamp - b.timestamp)
            .findIndex((assignment) => assignment.participantId === participantId);
        const creationIndex = existingAssignment.creationIndex
          ?? assignments.sort((a, b) => a.createdTime - b.createdTime)
            .findIndex((assignment) => assignment.participantId === participantId);
        return { sequenceIndex, creationIndex };
      }

      const reusableAssignment = assignments
        .filter((assignment) => assignment.rejected && !assignment.claimed && assignment.participantId !== participantId)
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      const creationIndex = assignments.length;
      const unclaimedAssignments = assignments.filter((assignment) => !assignment.claimed);
      let nextSequenceIndex = unclaimedAssignments.length;
      if (!reusableAssignment) {
        const legacySlots = unclaimedAssignments.some((assignment) => assignment.sequenceIndex === undefined)
          ? new Map(assignments.filter((assignment) => !assignment.rejected)
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((assignment, index) => [assignment.participantId, index]))
          : undefined;
        // Undo can leave holes below later allocations; reclaim those holes without renumbering participants.
        const occupiedSlots = new Set(unclaimedAssignments.map((assignment) => (
          assignment.reusableSequenceIndex ?? assignment.sequenceIndex ?? legacySlots?.get(assignment.participantId)
        )));
        nextSequenceIndex = 0;
        while (occupiedSlots.has(nextSequenceIndex)) {
          nextSequenceIndex += 1;
        }
      }
      const sequenceIndex = reusableAssignment?.reusableSequenceIndex
        ?? reusableAssignment?.sequenceIndex
        ?? (reusableAssignment
          ? assignments.filter((assignment) => (
            !assignment.rejected && assignment.timestamp < reusableAssignment.timestamp
          )).length
          : nextSequenceIndex);

      if (reusableAssignment) {
        assignmentsByParticipant[reusableAssignment.participantId] = {
          ...reusableAssignment,
          claimed: true,
          sequenceIndex,
        };
      }

      assignmentsByParticipant[participantId] = {
        ...sequenceAssignment,
        ...(reusableAssignment ? {
          timestamp: reusableAssignment.timestamp,
          claimedParticipantId: reusableAssignment.participantId,
        } : {}),
        sequenceIndex,
        creationIndex,
      };
      await this.studyDatabase.setItem(sequenceAssignmentPath, assignmentsByParticipant);
      return { sequenceIndex, creationIndex };
    });
  }

  protected async _updateSequenceAssignmentFields(participantId: string, updatedFields: Partial<SequenceAssignment>) {
    await this.verifyStudyDatabase();
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }
    await withLocalAllocationLock(`${this.collectionPrefix}${this.studyId}/sequenceAssignment`, async () => {
      const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
      const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};
      const existingAssignment = sequenceAssignments[participantId];
      if (!existingAssignment) {
        throw new Error(`Sequence assignment for participant ${participantId} not found`);
      }
      const updatedAssignment = {
        ...existingAssignment,
        ...updatedFields,
      };
      if (Object.hasOwn(updatedFields, 'conditions') && updatedFields.conditions === undefined) {
        delete updatedAssignment.conditions;
      }
      sequenceAssignments[participantId] = updatedAssignment;
      await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
    });
  }

  protected async _getSequenceAssignment(participantId: string) {
    await this.verifyStudyDatabase();
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};
    return sequenceAssignments[participantId] || null;
  }

  protected async _runWithLock<T>(lockKey: string, operation: () => Promise<T>) {
    const scopedLockKey = `${this.collectionPrefix}${this.studyId}:${lockKey}`;
    const previousLock = LocalStorageEngine.lockChains.get(scopedLockKey) ?? Promise.resolve();
    let releaseLock: (() => void) | undefined;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const queuedLock = previousLock.catch(() => undefined).then(() => currentLock);
    LocalStorageEngine.lockChains.set(scopedLockKey, queuedLock);

    await previousLock.catch(() => undefined);
    try {
      return await operation();
    } finally {
      releaseLock?.();
      if (LocalStorageEngine.lockChains.get(scopedLockKey) === queuedLock) {
        LocalStorageEngine.lockChains.delete(scopedLockKey);
      }
    }
  }

  protected async _completeCurrentParticipantRealtime() {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const participantId = this.currentParticipantId;
    await withLocalAllocationLock(`${this.collectionPrefix}${this.studyId}/sequenceAssignment`, async () => {
      const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
      const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};

      if (sequenceAssignments[participantId]) {
        sequenceAssignments[participantId] = {
          ...sequenceAssignments[participantId],
          completed: new Date().getTime(),
        };
      } else {
        throw new Error('Participant sequence assignment not found');
      }
      await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
    });
  }

  protected async _rejectParticipantRealtime(participantId: string) {
    await this.verifyStudyDatabase();
    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    await withLocalAllocationLock(sequenceAssignmentPath, async () => {
      const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(
        sequenceAssignmentPath,
      ) || {};
      const participantSequenceAssignment = sequenceAssignments[participantId];
      if (!participantSequenceAssignment || participantSequenceAssignment.rejected) {
        return;
      }

      // If this participant reused a rejected slot, release that source slot and create
      // a distinct vacancy for this rejection.
      const claimedAssignmentData = participantSequenceAssignment.claimedParticipantId
        ? sequenceAssignments[participantSequenceAssignment.claimedParticipantId]
        : Object.values(sequenceAssignments).find(
          (assignment) => assignment.claimed
            && assignment.timestamp === participantSequenceAssignment.timestamp,
        );
      if (claimedAssignmentData) {
        const assignments = Object.values(sequenceAssignments);
        const indexedSlots = assignments.flatMap((assignment) => [
          assignment.sequenceIndex,
          assignment.reusableSequenceIndex,
        ]).filter((index): index is number => index !== undefined);
        const logicalSlotCount = assignments.filter((assignment) => !assignment.claimed).length;
        const reusableSequenceIndex = Math.max(
          logicalSlotCount,
          indexedSlots.length > 0 ? Math.max(...indexedSlots) + 1 : 0,
        );

        // A timed-out source stays timed out rather than becoming rejected.
        sequenceAssignments[claimedAssignmentData.participantId] = {
          ...claimedAssignmentData,
          claimed: false,
          ...(claimedAssignmentData.autoTimedOutAt === undefined ? { rejected: true } : {}),
        };
        sequenceAssignments[participantId] = {
          ...participantSequenceAssignment,
          timestamp: new Date().getTime(),
          rejected: true,
          reusableSequenceIndex,
        };
      } else {
        sequenceAssignments[participantId] = {
          ...participantSequenceAssignment,
          rejected: true,
        };
      }
      await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
    });
  }

  protected async _undoRejectParticipantRealtime(participantId: string) {
    await this.verifyStudyDatabase();
    const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
    await withLocalAllocationLock(sequenceAssignmentPath, async () => {
      const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};

      const participantSequenceAssignment = sequenceAssignments[participantId];
      if (participantSequenceAssignment) {
        const updatedParticipantSequenceAssignment = {
          ...participantSequenceAssignment,
          rejected: false,
        };
        delete updatedParticipantSequenceAssignment.reusableSequenceIndex;
        if (participantSequenceAssignment.claimedParticipantId) {
          const claimedAssignmentData = sequenceAssignments[participantSequenceAssignment.claimedParticipantId];
          if (claimedAssignmentData) {
            claimedAssignmentData.claimed = true;
            // A timed-out source stays timed out rather than becoming rejected.
            if (claimedAssignmentData.autoTimedOutAt === undefined) {
              claimedAssignmentData.rejected = true;
            }
            updatedParticipantSequenceAssignment.timestamp = claimedAssignmentData.timestamp;
          }
        }
        sequenceAssignments[participantId] = updatedParticipantSequenceAssignment;
        await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
      }
    });
  }

  protected async _claimSequenceAssignment(participantId: string) {
    await this.verifyStudyDatabase();
    await withLocalAllocationLock(`${this.collectionPrefix}${this.studyId}/sequenceAssignment`, async () => {
      const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
      const sequenceAssignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};
      const existingAssignment = sequenceAssignments[participantId];
      if (!existingAssignment) {
        throw new Error(`Sequence assignment for participant ${participantId} not found`);
      }
      // Merge into the record as it exists inside the lock. A completion,
      // rejection, or timeout that landed after the caller read the assignment
      // must survive being claimed for slot reuse.
      sequenceAssignments[participantId] = {
        ...existingAssignment,
        claimed: true,
      };
      await this.studyDatabase.setItem(sequenceAssignmentPath, sequenceAssignments);
    });
  }

  // The local engine has a single client, so its own clock is the only clock.
  protected async _getServerTimeMs(): Promise<number> {
    return Date.now();
  }

  protected async _markSequenceAssignmentTimedOut(participantId: string, timedOutAt: number): Promise<boolean> {
    return await withLocalAllocationLock(`${this.collectionPrefix}${this.studyId}/sequenceAssignment`, async () => {
      await this.verifyStudyDatabase();
      const sequenceAssignmentPath = `${this.collectionPrefix}${this.studyId}/sequenceAssignment`;
      const assignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(sequenceAssignmentPath) || {};
      const assignment = assignments[participantId];
      if (!assignment) {
        throw new Error(`Sequence assignment for participant ${participantId} not found`);
      }
      if (assignment.completed !== null || assignment.rejected || assignment.autoTimedOutAt !== undefined) {
        return false;
      }
      assignments[participantId] = { ...assignment, autoTimedOutAt: timedOutAt };
      await this.studyDatabase.setItem(sequenceAssignmentPath, assignments);
      return true;
    });
  }

  async initializeStudyDb(studyId: string) {
    // Create or retrieve database for study
    this.studyId = studyId;
  }

  async connect() {
    this.connected = true;
  }

  async getModes(studyId: string) {
    // Reads must not write: a write here would put back a copy read before a
    // concurrent settings update and erase that update.
    const modes = await this.readStoredModes(studyId);
    if (modes) {
      return modes;
    }

    // Creating the defaults is the one write, so it re-reads under the same
    // lock that settings updates hold.
    return await this._runWithLock('study-settings', async () => {
      const storedModes = await this.readStoredModes(studyId);
      if (storedModes) {
        return storedModes;
      }
      const defaults = { ...LocalStorageEngine.defaultModes };
      await this.studyDatabase.setItem(`${this.collectionPrefix}${studyId}/modes`, defaults);
      return defaults;
    });
  }

  private static readonly defaultModes: Record<REVISIT_MODE, boolean> = {
    dataCollectionEnabled: true,
    developmentModeEnabled: true,
    dataSharingEnabled: true,
  };

  private async readStoredModes(studyId: string) {
    const modes = await this.studyDatabase.getItem(`${this.collectionPrefix}${studyId}/modes`) as RuntimeStudySettings | null;
    return modes ? cleanupModes(modes as Record<string, boolean>) as RuntimeStudySettings : null;
  }

  // Runs while `_updateModesFields` holds the settings lock, which `getModes`
  // would wait on when it creates the defaults.
  protected async _readModesForUpdate(studyId: string): Promise<RuntimeStudySettings> {
    return await this.readStoredModes(studyId) ?? { ...LocalStorageEngine.defaultModes };
  }

  async initializeModesFrom(studyId: string, modes: Awaited<ReturnType<StorageEngine['getModes']>>) {
    const key = `${this.collectionPrefix}${studyId}/modes`;
    await this._runWithLock('study-settings', async () => {
      if (!await this.studyDatabase.getItem(key)) {
        await this.studyDatabase.setItem(key, modes);
      }
    });
  }

  async hasStoredModes(studyId: string) {
    return Boolean(await this.studyDatabase.getItem(`${this.collectionPrefix}${studyId}/modes`));
  }

  protected async _setMode(studyId: string, mode: REVISIT_MODE, value: boolean) {
    const key = `${this.collectionPrefix}${studyId}/modes`;
    // Unlike the cloud engines, this one does not create the modes on demand.
    if (await this.studyDatabase.getItem(key) === null) {
      throw new Error('Modes not initialized');
    }

    await this._updateModesFields(studyId, { [mode]: value });
  }

  protected async _setModesDocument(studyId: string, modesDocument: RuntimeStudySettings): Promise<void> {
    const key = `${this.collectionPrefix}${studyId}/modes`;
    await this.studyDatabase.setItem(key, modesDocument);
  }

  async getStudyHiddenFromLandingPage(studyId: string): Promise<boolean> {
    const key = `${this.collectionPrefix}${studyId}/hideStudyFromLandingPage`;
    return await this.studyDatabase.getItem<boolean>(key) === true;
  }

  async setStudyHiddenFromLandingPage(studyId: string, hidden: boolean): Promise<void> {
    const key = `${this.collectionPrefix}${studyId}/hideStudyFromLandingPage`;
    await this.studyDatabase.setItem(key, hidden);
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

  protected async _getWebcamRecordingUrl(task: string, participantId?: string) {
    await this.verifyStudyDatabase();
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }
    const webcamRecordingBlob = await this._getFromStorage(`webcamRecording/${participantId || this.currentParticipantId}`, task);
    if (!webcamRecordingBlob) {
      throw new Error(`WebcamRecording for task ${task} and participant ${participantId || this.currentParticipantId} not found`);
    }
    return URL.createObjectURL(webcamRecordingBlob);
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
      if (key.endsWith('/snapshots') || key.endsWith('modes') || key.endsWith('configHash') || key.endsWith('currentParticipantId') || key.endsWith('/hideStudyFromLandingPage')) {
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
    const targetKeys = keys.filter((key) => key.startsWith(path) && !key.includes('snapshots') && !key.endsWith('/hideStudyFromLandingPage'));
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

  protected async _addDirectoryNameToSnapshots(
    directoryName: string,
    studyId: string,
    participantCounts?: SnapshotParticipantCounts,
  ) {
    await this.verifyStudyDatabase();
    const metadataKey = `${this.collectionPrefix}${studyId}/snapshots`;
    const metadata = await this.studyDatabase.getItem<SnapshotDocContent>(metadataKey) || {};
    if (!metadata[directoryName]) {
      metadata[directoryName] = participantCounts
        ? { name: directoryName, participantCounts }
        : { name: directoryName };
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
      snapshots[key] = { ...snapshots[key], name: newName };
      await this.studyDatabase.setItem(snapshotsKey, snapshots);
    } else {
      throw new Error(`Snapshot with name ${key} does not exist`);
    }
  }

  protected async _updateSnapshotParticipantCounts(
    snapshotName: string,
    studyId: string,
    participantCounts: SnapshotParticipantCounts,
  ) {
    await this.verifyStudyDatabase();
    const snapshotsKey = `${this.collectionPrefix}${studyId}/snapshots`;
    const snapshots = await this.studyDatabase.getItem<SnapshotDocContent>(snapshotsKey) || {};
    if (snapshots[snapshotName]) {
      snapshots[snapshotName] = { ...snapshots[snapshotName], participantCounts };
      await this.studyDatabase.setItem(snapshotsKey, snapshots);
    } else {
      throw new Error(`Snapshot with name ${snapshotName} does not exist`);
    }
  }

  protected override async getStageAllocation(stage: string): Promise<StageAllocation> {
    await this.verifyStudyDatabase();
    const assignments = await this.studyDatabase.getItem<Record<string, SequenceAssignment>>(`${this.collectionPrefix}${this.studyId}/sequenceAssignment`) || {};
    return getStageAllocationFromAssignments(Object.values(assignments), stage);
  }
}
