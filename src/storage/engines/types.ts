import localforage from 'localforage';
import throttle from 'lodash.throttle';
import { v4 as uuidv4 } from 'uuid';
import { StudyConfig } from '../../parser/types';
import { ParticipantMetadata, Sequence } from '../../store/types';
import { ParticipantData, ParticipantDataWithStatus } from '../types';
import { hash, isParticipantData } from './utils/storageEngineHelpers';
import { shouldPreferCachedParticipantData } from './utils/participantDataRecovery';
import { RevisitNotification } from '../../utils/notifications';
import { parseConditionParam } from '../../utils/handleConditionLogic';
import {
  ParticipantTags, Tag, TaglessEditedText, TranscribedAudio,
} from '../../analysis/individualStudy/thinkAloud/types';

export interface StoredUser {
  email: string | null,
  uid: string | null,
}

export interface UserWrapped {
  user: StoredUser | null,
  determiningStatus: boolean,
  isAdmin: boolean,
  adminVerification: boolean
}

export type SequenceAssignment = {
  participantId: string;
  timestamp: number; // Use Timestamp for Firebase, number for local storage
  rejected: boolean;
  claimed: boolean;
  completed: number | null;
  createdTime: number;
  total: number; // Total number of questions/steps
  answered: string[]; // Number of answered questions
  isDynamic: boolean; // Whether the study contains dynamic blocks
  stage: string; // The stage of the participant in the study
  conditions?: string[]; // The study condition(s) assigned to this participant.
};

export type REVISIT_MODE = 'dataCollectionEnabled' | 'developmentModeEnabled' | 'dataSharingEnabled';

export function cleanupModes(modes: Record<string, boolean>): Record<REVISIT_MODE, boolean> {
  const cleanedModes: Record<string, boolean> = { ...modes };

  if ('studyNavigatorEnabled' in modes && !('developmentModeEnabled' in modes)) {
    cleanedModes.developmentModeEnabled = modes.studyNavigatorEnabled;
    delete cleanedModes.studyNavigatorEnabled;
  }

  if ('analyticsInterfacePubliclyAccessible' in modes && !('dataSharingEnabled' in modes)) {
    cleanedModes.dataSharingEnabled = modes.analyticsInterfacePubliclyAccessible;
    delete cleanedModes.analyticsInterfacePubliclyAccessible;
  }

  return cleanedModes as Record<REVISIT_MODE, boolean>;
}

export interface StageInfo {
  stageName: string;
  color: string;
}

interface StageData {
  currentStage: StageInfo;
  allStages: StageInfo[];
}

export interface ConditionData {
  allConditions: string[];
  conditionCounts: Record<string, number>;
}

const defaultStageColor = '#F05A30';

export type StorageObjectType = 'sequenceArray' | 'participantData' | 'config' | string;
export type StorageObject<T extends StorageObjectType> =
  T extends 'sequenceArray'
  ? Sequence[]
  : T extends 'participantData'
  ? ParticipantData
  : T extends 'config'
  ? StudyConfig
  : T extends 'transcription.txt'
  ? TranscribedAudio
  : T extends 'editedText'
  ? TaglessEditedText[]
  : T extends 'participantTags'
  ? ParticipantTags
  : T extends 'tags'
  ? Tag[]
  : Blob; // Fallback for any random string

interface CloudStorageEngineError {
  title: string;
  message: string;
  details?: string;
}

// Success response always has list of notifications which are then presented to user. Notifications can contain pieces which are individual errors from upstream functions.
interface ActionResponseSuccess {
  status: 'SUCCESS';
  error?: undefined;
  notifications?: RevisitNotification[];
}

// Failed responses never take notifications, only report error. Notifications will be handled in downstream functions.
interface ActionResponseFailed {
  status: 'FAILED';
  error: CloudStorageEngineError;
  notifications?: undefined;
}

export type ActionResponse =
  | ActionResponseSuccess
  | ActionResponseFailed;

// Represents a snapshot name item with an original name and an optional alternate (renamed) name.
export type SnapshotDocContent = Record<string, { name: string; }>;

export type FinalizeParticipantResult = {
  status: 'complete' | 'retry' | 'error';
  message?: string;
  retryable?: boolean;
};

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function cloneParticipantDataSnapshot(participantData: ParticipantData) {
  return structuredClone(participantData);
}

export abstract class StorageEngine {
  protected engine: 'localStorage' | 'supabase' | 'firebase';

  protected testing: boolean;

  protected cloudEngine: boolean = false;

  protected connected = false;

  protected abstract participantStore: ReturnType<typeof localforage.createInstance>;

  protected collectionPrefix = import.meta.env.DEV ? 'dev-' : 'prod-';

  protected studyId: string | undefined;

  protected currentParticipantId: string | undefined;

  protected participantData: ParticipantData | undefined;

  protected participantDataWriteDelayMs = 3000;

  private pendingParticipantDataWrite:
  | { participantId: string; snapshot: ParticipantData; cache: boolean }
  | undefined;

  private pendingParticipantDataWriteTimer: ReturnType<typeof setTimeout> | null = null;

  private participantDataWriteChain: Promise<void> = Promise.resolve();

  private participantDataWriteError: Error | null = null;

  private pendingAssetUploads = new Map<string, Promise<void>>();

  private pendingAssetOperations = new Set<Promise<unknown>>();

  private failedAssetUploads = new Map<string, Error>();

  private assetUploadActivityVersion = 0;

  constructor(engine: typeof this.engine, testing: boolean) {
    this.engine = engine;
    this.testing = testing;
  }

  isConnected() {
    return this.connected;
  }

  getEngine() {
    return this.engine;
  }

  isCloudEngine() {
    return this.cloudEngine;
  }

  /*
  * PRIMITIVE METHODS
  * These methods are provided by the storage engine implementation and are used by the higher-level methods.
  */
  /* Storage ------------------------------------------------------------- */
  // Gets an object from the storage engine. The object is identified by its type and studyId.
  protected abstract _getFromStorage<T extends StorageObjectType>(prefix: string, type: T, studyId?: string): Promise<StorageObject<T> | null>;

  // Pushes an object to the storage engine. The object is identified by its type and studyId.
  protected abstract _pushToStorage<T extends StorageObjectType>(prefix: string, type: T, objectToUpload: StorageObject<T>): Promise<void>;

  // Deletes an object from the storage engine. The object is identified by its type and studyId.
  protected abstract _deleteFromStorage<T extends StorageObjectType>(prefix: string, type: T): Promise<void>;

  // Caches an object in the storage engine (using cache headers) to avoid fetching it from the server every time.
  protected abstract _cacheStorageObject<T extends StorageObjectType>(prefix: string, type: T): Promise<void>;

  /* Realtime database --------------------------------------------------- */
  // Verifies that the realtime study database and storage is set up correctly.
  protected abstract _verifyStudyDatabase(): Promise<void>;

  // Gets the current config hash from the storage engine using the engine's realtime database.
  protected abstract _getCurrentConfigHash(): Promise<string | null>;

  // Sets the current config hash in the storage engine using the engine's realtime database.
  protected abstract _setCurrentConfigHash(configHash: string): Promise<void>;

  /* General/Realtime ---------------------------------------------------- */
  // Gets all sequence assignments for the given studyId. The sequence assignments are sorted ascending by timestamp.
  public abstract getAllSequenceAssignments(studyId: string): Promise<SequenceAssignment[]>;

  // Creates a sequence assignment for the given participantId and sequenceAssignment. Cloud storage engines should use the realtime database to create the sequence assignment and should use the server to prevent race conditions (i.e. using server timestamps).
  protected abstract _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment, withServerTimestamp: boolean): Promise<void>;

  // Updates specific top-level fields in an existing sequence assignment without modifying timestamp fields.
  // This operation is a shallow patch (no deep merge for nested objects).
  protected abstract _updateSequenceAssignmentFields(
    participantId: string,
    updatedFields: Partial<SequenceAssignment>,
  ): Promise<void>;

  // Gets a single sequence assignment for the given participantId.
  protected abstract _getSequenceAssignment(participantId: string): Promise<SequenceAssignment | null>;

  // Sets the participant to completed in the sequence assignments in the realtime database.
  protected abstract _completeCurrentParticipantRealtime(): Promise<void>;

  // Rejects the participant in the realtime database sequence assignments. This must also reverse any claimed sequence assignments.
  protected abstract _rejectParticipantRealtime(participantId: string): Promise<void>;

  // Unrejects the participant in the realtime database sequence assignments. This must also reverse any claimed sequence assignments.
  protected abstract _undoRejectParticipantRealtime(participantId: string): Promise<void>;

  // Helper function to claim a sequence assignment of the given participant in the realtime database.
  protected abstract _claimSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment): Promise<void>;

  // Sets up the study database (firestore, indexedDB, etc.) for the given studyId. Also sets the studyId in the storage engine.
  abstract initializeStudyDb(studyId: string): Promise<void>;

  // Connects to the storage engine. This method might not need to do anything for some storage engines, but it is required for consistency.
  // It should set the `connected` property to true if the connection is successful.
  abstract connect(): Promise<void>;

  // Gets the modes for the given studyId. The modes are stored as a record with the mode name as the key and a boolean value indicating whether the mode is enabled or not.
  abstract getModes(studyId: string): Promise<Record<REVISIT_MODE, boolean> & { stage?: StageData }>;

  // Sets the mode for the given studyId. The mode is stored as a record with the mode name as the key and a boolean value indicating whether the mode is enabled or not.
  abstract setMode(studyId: string, mode: REVISIT_MODE, value: boolean): Promise<void>;

  // Protected helper: Sets the full modes document (including stage data and mode flags)
  protected abstract _setModesDocument(studyId: string, modesDocument: Record<REVISIT_MODE, boolean> & { stage?: StageData }): Promise<void>;

  // Gets the audio URL for the given task and participantId. This method is used to fetch the audio file from the storage engine.
  protected abstract _getAudioUrl(task: string, participantId?: string): Promise<string | null>;

  // Gets the screen recording URL for the given task and participantId. This method is used to fetch the screen recording video file from the storage engine.
  protected abstract _getScreenRecordingUrl(task: string, participantId?: string): Promise<string | null>;

  // Gets the transcript URL for the given task and participantId. (Optional - not all storage engines need to implement this, only if they generate transcripts).
  protected _getTranscriptUrl?(task: string, participantId?: string): Promise<string | null>;

  // Resets the entire study database for testing purposes. This is used to reset the study database to a clean state for testing.
  protected abstract _testingReset(studyId: string): Promise<void>;

  /* Snapshots ----------------------------------------------------------- */
  // Gets the snapshot doc for the given studyId.
  abstract getSnapshots(studyId: string): Promise<SnapshotDocContent>;

  // Checks if the storage directory to see if the given path exists.
  protected abstract _directoryExists(path: string): Promise<boolean>;

  // Copies a storage directory and all its contents.
  protected abstract _copyDirectory(source: string, target: string): Promise<void>;

  // Deletes a storage directory and all its contents.
  protected abstract _deleteDirectory(path: string): Promise<void>;

  // Copies the realtime data from the source to the target. This is used by createSnapshot to copy the realtime data associated with a snapshot.
  protected abstract _copyRealtimeData(source: string, target: string): Promise<void>;

  // Deletes the realtime data for the given target. This is used by removeSnapshotOrLive to delete the realtime data associated with a snapshot or live data.
  protected abstract _deleteRealtimeData(path: string): Promise<void>;

  // Adds a directory name to the metadata. This is used by createSnapshot
  protected abstract _addDirectoryNameToSnapshots(directoryName: string, studyId: string): Promise<void>;

  // Removes a snapshot from the metadata. This is used by removeSnapshotOrLive
  protected abstract _removeDirectoryNameFromSnapshots(directoryName: string, studyId: string): Promise<void>;

  // Updates a snapshot in the metadata. This is used by renameSnapshot
  protected abstract _changeDirectoryNameInSnapshots(oldName: string, newName: string, studyId: string): Promise<void>;

  /*
  * THROTTLED METHODS
  * These methods are used to throttle the calls to the storage engine's methods that can be called frequently.
  */
  private __throttleVerifyStudyDatabase = throttle(
    () => new Promise<void>((resolve, reject) => {
      this._verifyStudyDatabase()
        .then(() => {
          resolve();
        })
        .catch((e) => {
          this.connected = false;
          console.error('Error verifying study database:', e);
          reject(e);
        });
    }),
    10000,
  );

  /*
  * HIGHER-LEVEL METHODS
  * These methods are used by the application to interact with the storage engine and provide consistent behavior across different storage engines.
  * They are built on top of the primitive methods and provide a more user-friendly interface.
  */
  // Verify study database using provided primitive from storage engine with a throttle of 10 seconds.
  protected async verifyStudyDatabase() {
    return await this.__throttleVerifyStudyDatabase();
  }

  private getParticipantDataSnapshotStorageKey(participantId: string) {
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    return `${this.collectionPrefix}${this.studyId}/participants/${participantId}/localParticipantData`;
  }

  private async cacheParticipantDataSnapshot(snapshot: ParticipantData, participantId?: string) {
    const targetParticipantId = participantId || this.currentParticipantId;
    if (!this.studyId || !targetParticipantId) {
      return;
    }

    try {
      await this.participantStore.setItem(
        this.getParticipantDataSnapshotStorageKey(targetParticipantId),
        cloneParticipantDataSnapshot(snapshot),
      );
    } catch (error) {
      console.warn('Failed to cache participant data locally:', error);
    }
  }

  private async getCachedParticipantDataSnapshot(participantId?: string) {
    const targetParticipantId = participantId || this.currentParticipantId;
    if (!this.studyId || !targetParticipantId) {
      return null;
    }

    try {
      const cachedParticipantData = await this.participantStore.getItem<ParticipantData>(
        this.getParticipantDataSnapshotStorageKey(targetParticipantId),
      );

      return isParticipantData(cachedParticipantData) ? cachedParticipantData : null;
    } catch (error) {
      console.warn('Failed to read cached participant data:', error);
      return null;
    }
  }

  private clearPendingParticipantDataWriteTimer() {
    if (this.pendingParticipantDataWriteTimer) {
      clearTimeout(this.pendingParticipantDataWriteTimer);
      this.pendingParticipantDataWriteTimer = null;
    }
  }

  private recordParticipantDataWriteError(error: unknown) {
    this.participantDataWriteError = normalizeError(error);
  }

  private consumeParticipantDataWriteError() {
    const error = this.participantDataWriteError;
    this.participantDataWriteError = null;
    return error;
  }

  private async enqueueParticipantDataWrite(
    participantId: string,
    snapshot: ParticipantData,
    cache: boolean,
  ) {
    const write = async () => {
      this.participantDataWriteError = null;
      try {
        await this._pushToStorage(
          `participants/${participantId}`,
          'participantData',
          snapshot,
        );

        if (cache) {
          await this._cacheStorageObject(
            `participants/${participantId}`,
            'participantData',
          );
        }
      } catch (error) {
        this.recordParticipantDataWriteError(error);
        throw this.participantDataWriteError;
      }
    };

    const queuedWrite = this.participantDataWriteChain
      .catch(() => undefined)
      .then(write);

    this.participantDataWriteChain = queuedWrite
      .then(() => undefined)
      .catch(() => undefined);

    return queuedWrite;
  }

  private scheduleParticipantDataWrite(snapshot: ParticipantData, cache: boolean = false) {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    this.pendingParticipantDataWrite = {
      participantId: this.currentParticipantId,
      snapshot: cloneParticipantDataSnapshot(snapshot),
      cache,
    };

    this.clearPendingParticipantDataWriteTimer();
    this.pendingParticipantDataWriteTimer = setTimeout(() => {
      const pendingWrite = this.pendingParticipantDataWrite;
      this.pendingParticipantDataWrite = undefined;
      this.pendingParticipantDataWriteTimer = null;

      if (!pendingWrite) {
        return;
      }

      this.enqueueParticipantDataWrite(
        pendingWrite.participantId,
        pendingWrite.snapshot,
        pendingWrite.cache,
      ).catch(() => undefined);
    }, this.participantDataWriteDelayMs);
  }

  protected async persistCurrentParticipantData(
    options: { immediate?: boolean; cache?: boolean } = {},
  ) {
    if (!this.currentParticipantId || this.participantData === undefined) {
      throw new Error('Participant not initialized');
    }

    const snapshot = cloneParticipantDataSnapshot(this.participantData);
    const { immediate = false, cache = false } = options;

    await this.cacheParticipantDataSnapshot(snapshot, this.currentParticipantId);
    await this.verifyStudyDatabase();

    if (!immediate) {
      this.scheduleParticipantDataWrite(snapshot, cache);
      return;
    }

    this.clearPendingParticipantDataWriteTimer();
    this.pendingParticipantDataWrite = undefined;
    await this.enqueueParticipantDataWrite(this.currentParticipantId, snapshot, cache);
  }

  async flushPendingParticipantData() {
    this.clearPendingParticipantDataWriteTimer();

    if (this.pendingParticipantDataWrite) {
      const pendingWrite = this.pendingParticipantDataWrite;
      this.pendingParticipantDataWrite = undefined;
      await this.enqueueParticipantDataWrite(
        pendingWrite.participantId,
        pendingWrite.snapshot,
        pendingWrite.cache,
      );
    }

    await this.participantDataWriteChain;

    const error = this.consumeParticipantDataWriteError();
    if (error) {
      throw error;
    }
  }

  private recordAssetUploadError(assetKey: string, error: unknown) {
    this.failedAssetUploads.set(assetKey, normalizeError(error));
  }

  private clearAssetUploadError(assetKey: string) {
    this.failedAssetUploads.delete(assetKey);
  }

  private getAssetUploadError() {
    return this.failedAssetUploads.values().next().value || null;
  }

  private noteAssetUploadActivity() {
    this.assetUploadActivityVersion += 1;
  }

  private async waitForAssetUploadIdleWindow() {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  private trackAssetOperation<T>(assetKey: string, operation: () => Promise<T>) {
    this.noteAssetUploadActivity();
    this.clearAssetUploadError(assetKey);

    const operationPromise = operation()
      .catch((error) => {
        const normalizedError = normalizeError(error);
        this.recordAssetUploadError(assetKey, normalizedError);
        throw normalizedError;
      })
      .finally(() => {
        this.pendingAssetOperations.delete(operationPromise);
        this.noteAssetUploadActivity();
      });

    this.pendingAssetOperations.add(operationPromise);

    return operationPromise;
  }

  private async waitForPendingAssetUploads(): Promise<Error | null> {
    const uploadPromises = [
      ...this.pendingAssetUploads.values(),
      ...this.pendingAssetOperations,
    ];
    if (uploadPromises.length === 0) {
      const activityVersion = this.assetUploadActivityVersion;
      await this.waitForAssetUploadIdleWindow();

      if (
        this.pendingAssetUploads.size === 0
        && this.pendingAssetOperations.size === 0
        && this.assetUploadActivityVersion === activityVersion
      ) {
        return this.getAssetUploadError();
      }

      return this.waitForPendingAssetUploads();
    }

    await Promise.allSettled(uploadPromises);

    return this.waitForPendingAssetUploads();
  }

  async getStageData(studyId: string): Promise<StageData> {
    const modesDoc = await this.getModes(studyId);

    if (modesDoc && modesDoc.stage) {
      return modesDoc.stage as StageData;
    }

    // Set default stage data if it doesn't exist
    const defaultStageData: StageData = {
      currentStage: { stageName: 'DEFAULT', color: defaultStageColor },
      allStages: [{ stageName: 'DEFAULT', color: defaultStageColor }],
    };
    await this.setCurrentStage(studyId, 'DEFAULT', defaultStageColor);
    return defaultStageData;
  }

  async getConditionData(studyId: string): Promise<ConditionData> {
    const sequenceAssignments = await this.getAllSequenceAssignments(studyId);
    const conditionCounts: Record<string, number> = {};

    sequenceAssignments.forEach((assignment) => {
      const normalizedConditions = parseConditionParam(assignment.conditions);
      const conditionValues = normalizedConditions.length > 0 ? normalizedConditions : ['default'];
      conditionValues.forEach((condition) => {
        conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
      });
    });

    return {
      allConditions: Object.keys(conditionCounts).sort(),
      conditionCounts,
    };
  }

  // Setting current stage
  async setCurrentStage(studyId: string, stageName: string, color: string = defaultStageColor): Promise<void> {
    const modesDoc = await this.getModes(studyId);

    // Initialize if doesn't exist or invalid
    if (!modesDoc.stage) {
      modesDoc.stage = {
        currentStage: { stageName: 'DEFAULT', color: defaultStageColor },
        allStages: [{ stageName: 'DEFAULT', color: defaultStageColor }],
      };
    }

    // Check if stage already exists in allStages
    const existingStageIndex = modesDoc.stage.allStages.findIndex(
      (s) => s.stageName === stageName,
    );

    if (existingStageIndex === -1) {
      modesDoc.stage.allStages.push({ stageName, color });
    }

    modesDoc.stage.currentStage = { stageName, color };

    const updatedModesDoc = {
      ...modesDoc,
      stage: modesDoc.stage,
    };

    await this._setModesDocument(studyId, updatedModesDoc);
  }

  // Updating stage color
  async updateStageColor(studyId: string, stageName: string, color: string): Promise<void> {
    const modesDoc = await this.getModes(studyId);

    if (!modesDoc.stage) {
      throw new Error('Stage data not initialized');
    }

    const updatedAllStages = modesDoc.stage.allStages.map(
      (s) => (s.stageName === stageName ? { ...s, color } : s),
    );

    const updatedCurrentStage = modesDoc.stage.currentStage.stageName === stageName
      ? { ...modesDoc.stage.currentStage, color }
      : modesDoc.stage.currentStage;

    const updatedStageData = {
      currentStage: updatedCurrentStage,
      allStages: updatedAllStages,
    };

    const updatedModesDoc = {
      ...modesDoc,
      stage: updatedStageData,
    };

    await this._setModesDocument(studyId, updatedModesDoc);
  }

  // Saves the new config for the study. This will overwrite the existing sequence array so that the new sequences are compatible with the new config.
  async saveConfig(config: StudyConfig) {
    const currentConfigHash = await this._getCurrentConfigHash();
    // Hash the provided config
    const configHash = await hash(JSON.stringify(config));

    // Push the config to storage and cache it, since it won't change
    await this._pushToStorage(
      `configs/${configHash}`,
      'config',
      config,
    );
    await this._cacheStorageObject(`configs/${configHash}`, 'config');

    // Clear sequence array if the config has changed.
    // Keep currentParticipantId so existing participant sessions can continue
    // against their original participantConfigHash.
    if (currentConfigHash && currentConfigHash !== configHash) {
      try {
        await this._deleteFromStorage('', 'sequenceArray');
      } catch {
        // pass, if this happens, we didn't have a sequence array yet
      }
    }

    await this._setCurrentConfigHash(configHash);
  }

  // Gets all configs from the storage engine based on the provided temporary hashes and studyId.
  async getAllConfigsFromHash(tempHashes: string[], studyId: string) {
    const allConfigs = tempHashes.map(async (singleHash) => [singleHash, await this._getFromStorage(`configs/${singleHash}`, 'config', studyId)]);
    const configs = (await Promise.all(allConfigs)) as [string, StudyConfig][];
    return Object.fromEntries(configs);
  }

  // Gets the current participant ID from the URL, local persistence, or generates a new one if none exists.
  async getCurrentParticipantId(urlParticipantId?: string) {
    // Prioritize urlParticipantId and avoid persisting it across pages.
    if (urlParticipantId) {
      this.currentParticipantId = urlParticipantId;
      return urlParticipantId;
    }

    if (this.currentParticipantId) {
      return this.currentParticipantId;
    }

    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const storageKey = `${this.collectionPrefix}${this.studyId}/currentParticipantId`;
    const storedParticipantId = await this.participantStore.getItem<string>(storageKey);
    if (storedParticipantId) {
      this.currentParticipantId = storedParticipantId;
      return storedParticipantId;
    }

    this.currentParticipantId = uuidv4();
    await this.participantStore.setItem(storageKey, this.currentParticipantId);
    return this.currentParticipantId;
  }

  // Clears the current participant ID from persistence and resets the currentParticipantId property.
  async clearCurrentParticipantId() {
    this.currentParticipantId = undefined;
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const storageKey = `${this.collectionPrefix}${this.studyId}/currentParticipantId`;
    await this.participantStore.removeItem(storageKey);
  }

  // This function is one of the most critical functions in the storage engine.
  // It uses the notion of sequence intents and assignments to determine the current sequence for the participant.
  // It handles rejected participants and allows for reusing a rejected participant's sequence.
  protected async _getSequence(conditions?: string[]) {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }
    let sequenceAssignments = await this.getAllSequenceAssignments(this.studyId);

    const modes = await this.getModes(this.studyId);
    const stageData = await this.getStageData(this.studyId);
    const currentStage = stageData.currentStage.stageName;

    // Find all rejected documents
    const rejectedDocs = sequenceAssignments
      .filter((doc) => doc.rejected && !doc.claimed);
    if (rejectedDocs.length > 0) {
      const firstReject = rejectedDocs[0];
      const firstRejectTime = firstReject.timestamp;
      if (modes.dataCollectionEnabled) {
        // Make the sequence assignment document for the participant
        const participantSequenceAssignmentData: SequenceAssignment = {
          participantId: this.currentParticipantId,
          timestamp: firstRejectTime, // Use the timestamp of the first reject
          rejected: false,
          claimed: false,
          completed: null,
          createdTime: new Date().getTime(), // Placeholder, will be set to server timestamp in cloud engines
          total: 0,
          answered: [],
          isDynamic: false,
          stage: currentStage,
          ...(conditions ? { conditions } : {}),
        };
        // Mark the first reject as claimed
        await this._claimSequenceAssignment(firstReject.participantId, firstReject);
        // Set the participant's sequence assignment document
        await this._createSequenceAssignment(this.currentParticipantId, participantSequenceAssignmentData, false);
      }
    } else if (modes.dataCollectionEnabled) {
      const timestamp = new Date().getTime();
      const participantSequenceAssignmentData: SequenceAssignment = {
        participantId: this.currentParticipantId,
        timestamp, // Placeholder, will be set to server timestamp in cloud engines
        rejected: false,
        claimed: false,
        completed: null,
        createdTime: timestamp, // Placeholder, will be set to server timestamp in cloud engines
        total: 0,
        answered: [],
        isDynamic: false,
        stage: currentStage,
        ...(conditions ? { conditions } : {}),
      };
      await this._createSequenceAssignment(this.currentParticipantId, participantSequenceAssignmentData, true);
    }

    // Query all the intents to get a sequence and find our position in the queue
    sequenceAssignments = await this.getAllSequenceAssignments(this.studyId);

    // Get the latin square
    const sequenceArray = await this.getSequenceArray();
    if (!sequenceArray) {
      throw new Error('Latin square not initialized');
    }

    // Get the current row
    const intentIndex = sequenceAssignments.filter((assignment) => !assignment.rejected).findIndex(
      (assignment) => assignment.participantId === this.currentParticipantId,
    ) % sequenceArray.length;
    if (sequenceArray.length === 0) {
      throw new Error('Something really bad happened with sequence assignment');
    }
    // If index = -1, we probably have data collection disabled. Give a random assignment.
    if (intentIndex === -1) {
      return {
        currentRow: sequenceArray[Math.floor(Math.random() * sequenceArray.length)],
        creationIndex: 1,
      };
    }
    const currentRow = sequenceArray[intentIndex];

    if (!currentRow) {
      throw new Error('Latin square is empty');
    }

    const creationSorted = sequenceAssignments.sort((a, b) => a.createdTime - b.createdTime);

    const creationIndex = creationSorted.findIndex((assignment) => assignment.participantId === this.currentParticipantId) + 1;

    return { currentRow, creationIndex };
  }

  // Initializes or resumes a participant session for the given studyId. This will create a new participant data object if it does not exist, or update the existing one.
  async initializeParticipantSession(
    searchParams: Record<string, string>,
    config: StudyConfig,
    metadata: ParticipantMetadata,
    urlParticipantId?: string,
  ) {
    await this.verifyStudyDatabase();

    // Ensure that we have a participantId
    await this.getCurrentParticipantId(urlParticipantId);
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Check if the participant has already been initialized
    const participant = await this._getFromStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
    );
    const cachedParticipant = await this.getCachedParticipantDataSnapshot(this.currentParticipantId);

    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    // Get modes
    const modes = await this.getModes(this.studyId);
    const stageData = await this.getStageData(this.studyId);
    const currentStage = stageData.currentStage.stageName;

    if (
      cachedParticipant
      && (!isParticipantData(participant) || shouldPreferCachedParticipantData(cachedParticipant, participant))
    ) {
      this.participantData = cachedParticipant;
      return cachedParticipant;
    }

    if (isParticipantData(participant)) {
      // Participant already initialized
      this.participantData = participant;
      await this.cacheParticipantDataSnapshot(participant, this.currentParticipantId);
      return participant;
    }
    // Initialize participant
    const participantConfigHash = await hash(JSON.stringify(config));
    const parsedConditions = parseConditionParam(searchParams.condition);
    const conditions = parsedConditions.length > 0 ? parsedConditions : undefined;
    const { currentRow, creationIndex } = await this._getSequence(conditions);
    this.participantData = {
      participantId: this.currentParticipantId,
      participantConfigHash,
      sequence: currentRow,
      participantIndex: creationIndex,
      answers: {},
      searchParams,
      conditions,
      metadata,
      rejected: false,
      participantTags: [],
      stage: currentStage,
      createdTime: Date.now(),
    };

    if (modes.dataCollectionEnabled) {
      await this.persistCurrentParticipantData({ immediate: true });
    } else {
      await this.cacheParticipantDataSnapshot(this.participantData, this.currentParticipantId);
    }

    return this.participantData;
  }

  // Gets all participant IDs for the given studyId
  async getAllParticipantIds(studyId?: string) {
    const studyIdToUse = this.studyId || studyId;
    if (studyIdToUse === undefined) {
      throw new Error('Study ID is not set');
    }
    const sequenceAssignments = await this.getAllSequenceAssignments(studyIdToUse);
    return sequenceAssignments.map((assignment) => assignment.participantId);
  }

  async saveTags(tags: Tag[], tagType: string) {
    await this._pushToStorage(`audio/transcriptAndTags/${tagType}`, 'tags', tags);
  }

  async getTags(tagType: string) {
    return await this._getFromStorage(`audio/transcriptAndTags/${tagType}`, 'tags');
  }

  async getAllParticipantAndTaskTags(authEmail: string, participantId: string) {
    const tags = await this._getFromStorage(`audio/transcriptAndTags/${authEmail}/${participantId}`, 'participantTags');

    if (tags?.participantTags) {
      return tags;
    }

    this.saveAllParticipantAndTaskTags(authEmail, participantId, { participantTags: [], taskTags: {} });

    return { participantTags: [], taskTags: {} };
  }

  async saveAllParticipantAndTaskTags(authEmail: string, participantId: string, participantTags: ParticipantTags) {
    return this._pushToStorage(`audio/transcriptAndTags/${authEmail}/${participantId}`, 'participantTags', participantTags);
  }

  // Gets the participant data for the current participant or a specific participantId.
  async getParticipantData(participantId?: string) {
    await this.verifyStudyDatabase();

    if (this.currentParticipantId === null && !participantId) {
      throw new Error('Participant not initialized');
    }

    const participantData = await this._getFromStorage(
      `participants/${participantId || this.currentParticipantId}`,
      'participantData',
    );

    if (isParticipantData(participantData)) {
      const targetParticipantId = participantId || this.currentParticipantId;
      const cachedParticipantData = targetParticipantId === this.currentParticipantId
        ? await this.getCachedParticipantDataSnapshot(targetParticipantId)
        : null;

      if (
        cachedParticipantData
        && shouldPreferCachedParticipantData(cachedParticipantData, participantData)
      ) {
        return cachedParticipantData;
      }

      if (targetParticipantId === this.currentParticipantId) {
        await this.cacheParticipantDataSnapshot(participantData, targetParticipantId);
      }
      return participantData;
    }

    if (!participantId || participantId === this.currentParticipantId) {
      return await this.getCachedParticipantDataSnapshot(participantId);
    }

    return null;
  }

  getCurrentParticipantDataSnapshot() {
    if (!this.participantData) {
      return null;
    }

    return cloneParticipantDataSnapshot(this.participantData);
  }

  // Gets the participant tags for the current participant.
  async getParticipantTags(): Promise<string[]> {
    await this.verifyStudyDatabase();

    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    return participantData.participantTags;
  }

  // Adds a participant tag to the current participant.
  async addParticipantTags(tags: string[]) {
    await this.verifyStudyDatabase();
    if (!this.participantData) {
      throw new Error('Participant data not initialized');
    }
    this.participantData.participantTags = [...new Set([...this.participantData.participantTags, ...tags])];

    await this.persistCurrentParticipantData({ immediate: true });
  }

  // Removes participant tags from the current participant.
  async removeParticipantTags(tags: string[]): Promise<void> {
    await this.verifyStudyDatabase();

    if (!this.participantData) {
      throw new Error('Participant data not initialized');
    }
    this.participantData.participantTags = this.participantData.participantTags.filter((tag) => !tags.includes(tag));

    await this.persistCurrentParticipantData({ immediate: true });
  }

  // Updates the participant's stored search params.
  async updateParticipantSearchParams(searchParams: Record<string, string>) {
    await this.verifyStudyDatabase();

    if (!this.participantData) {
      throw new Error('Participant data not initialized');
    }

    this.participantData.searchParams = searchParams;

    await this.persistCurrentParticipantData({ immediate: true });
  }

  async updateStudyCondition(condition: string | string[]) {
    await this.verifyStudyDatabase();

    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const modes = await this.getModes(this.studyId);
    if (!modes.developmentModeEnabled) {
      throw new Error('Cannot update study condition when development mode is disabled');
    }

    if (!this.participantData) {
      throw new Error('Participant data not initialized');
    }

    const parsedConditions = parseConditionParam(condition);
    this.participantData.conditions = parsedConditions.length > 0 ? parsedConditions : undefined;

    await this.persistCurrentParticipantData({ immediate: true });

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    await this._updateSequenceAssignmentFields(
      this.currentParticipantId,
      { conditions: this.participantData.conditions },
    );
  }

  // Rejects a participant with the given participantId and reason.
  async rejectParticipant(participantId: string, reason: string) {
    const participant = await this._getFromStorage(
      `participants/${participantId}`,
      'participantData',
    );

    try {
      // If the user doesn't exist or is already rejected, return
      if (
        !participant
        || !isParticipantData(participant)
        || participant.rejected
      ) {
        return;
      }

      // set reject flag
      participant.rejected = {
        reason,
        timestamp: new Date().getTime(),
      };
      await this._pushToStorage(
        `participants/${participantId}`,
        'participantData',
        participant,
      );
      await this._rejectParticipantRealtime(participantId);
    } catch (error) {
      console.warn('Error rejecting participant:', error);
    }
  }

  // Rejects the current participant with the given reason.
  async rejectCurrentParticipant(reason: string) {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    return await this.rejectParticipant(this.currentParticipantId, reason);
  }

  // Un-rejects a participant with the given participantId.
  async undoRejectParticipant(participantId: string) {
    const participant = await this._getFromStorage(
      `participants/${participantId}`,
      'participantData',
    );

    try {
      // If the user doesn't exist, return
      if (!participant || !isParticipantData(participant)) {
        return;
      }

      // set reject flag to false
      participant.rejected = false;

      await this._pushToStorage(
        `participants/${participantId}`,
        'participantData',
        participant,
      );
      await this._undoRejectParticipantRealtime(participantId);
    } catch (error) {
      console.warn('Error undoing participant rejection:', error);
    }
  }

  // Un-rejects the current participant.
  async undoRejectCurrentParticipant() {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    return await this.undoRejectParticipant(this.currentParticipantId);
  }

  // Gets all participant IDs for the current studyId or a provided studyId.
  async getAllParticipantsData(studyId: string): Promise<ParticipantDataWithStatus[]> {
    const participantIds = await this.getAllParticipantIds(studyId);
    const sequenceAssignments = await this.getAllSequenceAssignments(studyId);
    const completedByParticipantId = new Map(
      sequenceAssignments.map((assignment) => [assignment.participantId, assignment.completed !== null]),
    );

    const participantPulls = participantIds.map(async (participantId) => {
      const participantData = await this._getFromStorage(
        `participants/${participantId}`,
        'participantData',
        studyId,
      );

      if (isParticipantData(participantData)) {
        return {
          ...participantData,
          completed: completedByParticipantId.get(participantId) ?? false,
        } satisfies ParticipantDataWithStatus;
      }
      return null;
    });

    const participantsData = await Promise.all(participantPulls);
    return participantsData.filter((participant): participant is ParticipantDataWithStatus => participant !== null);
  }

  async getParticipantsStatusCounts(studyId: string) {
    const sequenceAssignments = await this.getAllSequenceAssignments(studyId);

    const completed = sequenceAssignments.filter((assignment) => assignment.completed && !assignment.rejected).length;
    const rejected = sequenceAssignments.filter((assignment) => assignment.rejected).length;
    const inProgress = sequenceAssignments.length - completed - rejected;
    const minTime = sequenceAssignments.length > 0 ? sequenceAssignments[0].timestamp : null;
    const maxTime = sequenceAssignments.length > 0 ? sequenceAssignments.at(-1)!.timestamp : null;

    return {
      completed,
      rejected,
      inProgress,
      minTime,
      maxTime,
    };
  }

  // Save the answer into the local participant data and queue a debounced write to storage.
  async saveAnswers(answers: ParticipantData['answers']) {
    if (!this.currentParticipantId || this.participantData === undefined) {
      throw new Error('Participant not initialized');
    }

    // Don't save further answers if participant is rejected
    if (this.participantData.rejected) {
      return;
    }

    // Update the local copy of the participant data
    this.participantData = {
      ...this.participantData,
      answers,
    };

    await this.cacheParticipantDataSnapshot(this.participantData, this.currentParticipantId);
    this.scheduleParticipantDataWrite(this.participantData);
  }

  // Updates the progress data in the sequence assignment
  async updateProgressData(
    progressData: { total: number; answered: string[]; isDynamic: boolean },
    participantId?: string,
  ) {
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const targetParticipantId = participantId || this.currentParticipantId;
    if (!targetParticipantId) {
      throw new Error('Participant not initialized');
    }

    const existingAssignment = await this._getSequenceAssignment(targetParticipantId);

    if (existingAssignment) {
      await this._updateSequenceAssignmentFields(targetParticipantId, {
        total: progressData.total,
        answered: progressData.answered,
        isDynamic: progressData.isDynamic,
      });
    }
  }

  async getParticipantCompletionStatus(participantId?: string, studyId?: string): Promise<boolean> {
    const studyIdToUse = this.studyId || studyId;
    const participantIdToUse = participantId || this.currentParticipantId;

    if (!studyIdToUse) {
      throw new Error('Study not initialized');
    }

    if (!participantIdToUse) {
      throw new Error('Participant not initialized');
    }

    const sequenceAssignments = await this.getAllSequenceAssignments(studyIdToUse);
    const sequenceAssignment = sequenceAssignments.find(
      (assignment) => assignment.participantId === participantIdToUse,
    );

    return sequenceAssignment ? sequenceAssignment.completed !== null : false;
  }

  async finalizeParticipant(): Promise<FinalizeParticipantResult> {
    try {
      await this.flushPendingParticipantData();
    } catch (error) {
      return {
        status: 'error',
        message: normalizeError(error).message,
      };
    }

    const assetUploadError = await this.waitForPendingAssetUploads();

    if (!this.studyId) {
      throw new Error('Study not initialized');
    }

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    const modes = await this.getModes(this.studyId);
    if (!modes.dataCollectionEnabled) {
      return { status: 'complete' };
    }

    const alreadyCompleted = await this.getParticipantCompletionStatus();
    if (alreadyCompleted) {
      return { status: 'complete' };
    }

    if (assetUploadError) {
      return {
        status: 'error',
        message: assetUploadError.message,
        retryable: false,
      };
    }

    try {
      await this._completeCurrentParticipantRealtime();
    } catch (error) {
      return {
        status: 'error',
        message: normalizeError(error).message,
      };
    }

    return { status: 'complete' };
  }

  async getAsset(url: string | null) {
    if (!url) {
      return null;
    }

    const asset = new Promise<string>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';
      xhr.onload = () => {
        const blob = xhr.response;

        const _url = URL.createObjectURL(blob);

        resolve(_url);
      };
      xhr.open('GET', url);
      xhr.send();
    });

    return asset;
  }

  // Gets the audio for a specific task and participantId.
  async getAudio(
    task: string,
    participantId: string,
  ) {
    const url = await this._getAudioUrl(task, participantId);
    return await this.getAsset(url);
  }

  // Gets the audio download URL
  async getAudioUrl(
    task: string,
    participantId: string,
  ) {
    const url = await this._getAudioUrl(task, participantId);
    if (!url) {
      return null;
    }
    return url;
  }

  // Gets the transcript download URL (currently only supported by Firebase)
  async getTranscriptUrl(
    task: string,
    participantId: string,
  ) {
    if (!this._getTranscriptUrl) {
      return null;
    }

    const url = await this._getTranscriptUrl(task, participantId);
    if (!url) {
      return null;
    }
    return url;
  }

  async saveAsset(
    prefix: string,
    blob: Blob,
    taskName: string,
  ) {
    const assetKey = `${prefix}/${taskName}`;
    const participantKey = `${prefix}/${this.currentParticipantId}`;
    const uploadPromise = (async () => {
      try {
        await this._pushToStorage(participantKey, taskName, blob);
        this.clearAssetUploadError(assetKey);

        try {
          await this._cacheStorageObject(participantKey, taskName);
        } catch (error) {
          console.warn(`Failed to update cache headers for asset ${assetKey}:`, error);
        }
      } catch (error) {
        const normalizedError = normalizeError(error);
        this.recordAssetUploadError(assetKey, normalizedError);
        throw normalizedError;
      } finally {
        this.pendingAssetUploads.delete(assetKey);
      }
    })();

    this.pendingAssetUploads.set(assetKey, uploadPromise);

    await uploadPromise;
  }

  // Saves the audio stream to the storage engine. This method is used to save the audio recorded data from a MediaRecorder stream.
  async saveAudioRecording(
    blob: Blob,
    taskName: string,
  ) {
    return this.trackAssetOperation(`audio/${taskName}`, async () => {
      if (this.studyId === undefined) {
        throw new Error('Study ID is not set');
      }
      const modes = await this.getModes(this.studyId);
      if (!modes.dataCollectionEnabled) {
        throw new Error('Data collection is disabled for this study');
      }
      return this.saveAsset('audio', blob, taskName);
    });
  }

  // Gets the screen recording for a specific task and participantId.
  async getScreenRecording(
    task: string,
    participantId: string,
  ) {
    const url = await this._getScreenRecordingUrl(task, participantId);
    return this.getAsset(url);
  }

  // Saves the video stream to the storage engine. This method is used to save the screen recorded video data from a MediaRecorder stream.
  async saveScreenRecording(
    blob: Blob,
    taskName: string,
  ) {
    return this.trackAssetOperation(`screenRecording/${taskName}`, async () => {
      if (this.studyId === undefined) {
        throw new Error('Study ID is not set');
      }
      const modes = await this.getModes(this.studyId);
      if (!modes.dataCollectionEnabled) {
        throw new Error('Data collection is disabled for this study');
      }
      return this.saveAsset('screenRecording', blob, taskName);
    });
  }

  // Gets the sequence array from the storage engine.
  async getSequenceArray() {
    await this.verifyStudyDatabase();

    const sequenceArrayDocData = await this._getFromStorage(
      '',
      'sequenceArray',
    );

    return Array.isArray(sequenceArrayDocData) ? sequenceArrayDocData : null;
  }

  // Sets the sequence array in the storage engine.
  async setSequenceArray(latinSquare: Sequence[]) {
    await this.verifyStudyDatabase();

    await this._pushToStorage('', 'sequenceArray', latinSquare);
  }

  protected async __testingReset() {
    this.clearPendingParticipantDataWriteTimer();
    this.pendingParticipantDataWrite = undefined;
    this.participantDataWriteChain = Promise.resolve();
    this.participantDataWriteError = null;
    this.pendingAssetUploads.clear();
    this.pendingAssetOperations.clear();
    this.failedAssetUploads.clear();
    this.assetUploadActivityVersion = 0;
    this.participantData = undefined;
    if (this.studyId) {
      await this.clearCurrentParticipantId();
    } else {
      this.currentParticipantId = undefined;
    }
  }

  /* Snapshots --------------------------------------------------------- */
  // Creates a snapshot of the current study data. This will copy the current study data to a new directory with a timestamp.
  async createSnapshot(
    studyId: string,
    deleteData: boolean,
  ): Promise<ActionResponse> {
    const sourceName = `${this.collectionPrefix}${studyId}`;
    if (!(await this._directoryExists(`${sourceName}/participants`))) {
      console.warn(`Source directory ${sourceName} does not exist.`);

      return {
        status: 'FAILED',
        error: {
          message:
            'There is currently no data in your study. A snapshot could not be created.',
          title: 'Failed to Create Snapshot.',
        },
      };
    }

    const today = new Date();
    const year = today.getUTCFullYear();
    const month = (today.getUTCMonth() + 1).toString().padStart(2, '0');
    const date = today.getUTCDate().toString().padStart(2, '0');
    const hours = today.getUTCHours().toString().padStart(2, '0');
    const minutes = today.getUTCMinutes().toString().padStart(2, '0');
    const seconds = today.getUTCSeconds().toString().padStart(2, '0');

    const formattedDate = `${year}-${month}-${date}T${hours}:${minutes}:${seconds}`;

    const targetName = `${this.collectionPrefix}${studyId}-snapshot-${formattedDate}`;

    if (this.getEngine() === 'localStorage') {
      await this._copyDirectory(`${sourceName}/`, `${targetName}/`);
    } else {
      await this._copyDirectory(`${sourceName}/configs`, `${targetName}/configs`);
      await this._copyDirectory(`${sourceName}/participants`, `${targetName}/participants`);
      await this._copyDirectory(`${sourceName}/audio`, `${targetName}/audio`);
      await this._copyDirectory(`${sourceName}/screenRecording`, `${targetName}/screenRecording`);
      await this._copyDirectory(sourceName, targetName);
      await this._copyRealtimeData(sourceName, targetName);
    }
    await this._addDirectoryNameToSnapshots(targetName, studyId);

    const createSnapshotSuccessNotifications: RevisitNotification[] = [];
    if (deleteData) {
      const removeSnapshotResponse = await this.removeSnapshotOrLive(sourceName, studyId);
      if (removeSnapshotResponse.status === 'FAILED') {
        createSnapshotSuccessNotifications.push({
          title: removeSnapshotResponse.error.title,
          message: removeSnapshotResponse.error.message,
          color: 'red',
        });
      } else {
        createSnapshotSuccessNotifications.push({
          title: 'Success!',
          message: 'Successfully deleted live data.',
          color: 'green',
        });
      }
    }
    createSnapshotSuccessNotifications.push({
      message: 'Successfully created snapshot',
      title: 'Success!',
      color: 'green',
    });
    return {
      status: 'SUCCESS',
      notifications: createSnapshotSuccessNotifications,
    };
  }

  // Removes a snapshot or live data from the storage engine. This will delete the directory and all its contents, including the configs and participants directories.
  async removeSnapshotOrLive(
    targetName: string,
    studyId: string,
  ): Promise<ActionResponse> {
    const deletionTarget = targetName.startsWith(this.collectionPrefix) ? targetName : `${this.collectionPrefix}${targetName}`;
    try {
      if (this.getEngine() === 'localStorage') {
        await this._deleteDirectory(`${deletionTarget}/`);
      } else {
        await this._deleteDirectory(`${deletionTarget}/configs`);
        await this._deleteDirectory(`${deletionTarget}/participants`);
        await this._deleteDirectory(`${deletionTarget}/audio`);
        await this._deleteDirectory(`${deletionTarget}/screenRecording`);
        await this._deleteDirectory(deletionTarget);
        await this._deleteRealtimeData(deletionTarget);
      }

      await this._removeDirectoryNameFromSnapshots(deletionTarget, studyId);

      return {
        status: 'SUCCESS',
        notifications: [
          {
            message: 'Successfully deleted snapshot or live data.',
            title: 'Success!',
            color: 'green',
          },
        ],
      };
    } catch {
      return {
        status: 'FAILED',
        error: {
          title: 'Failed to delete live data or snapshot',
          message:
            'There was an unspecified error when trying to remove a snapshot or live data.',
        },
      };
    }
  }

  // Restores a snapshot to the live data directory.
  async restoreSnapshot(
    studyId: string,
    snapshotName: string,
  ): Promise<ActionResponse> {
    const originalName = `${this.collectionPrefix}${studyId}`;
    // Snapshot current collection
    const successNotifications: RevisitNotification[] = [];
    try {
      const createSnapshotResponse = await this.createSnapshot(studyId, true);
      if (createSnapshotResponse.status === 'FAILED') {
        console.warn('No live data to capture.');
        successNotifications.push({
          title: createSnapshotResponse.error.title,
          message: createSnapshotResponse.error.message,
          color: 'yellow',
        });
      } else {
        successNotifications.push({
          title: 'Success!',
          message: 'Successfully created snapshot of live data.',
          color: 'green',
        });
      }

      await this._copyDirectory(
        `${snapshotName}/configs`,
        `${originalName}/configs`,
      );
      await this._copyDirectory(
        `${snapshotName}/participants`,
        `${originalName}/participants`,
      );
      await this._copyDirectory(
        `${snapshotName}/audio`,
        `${originalName}/audio`,
      );
      await this._copyDirectory(
        `${snapshotName}/screenRecording`,
        `${originalName}/screenRecording`,
      );
      await this._copyDirectory(snapshotName, originalName);
      await this._copyRealtimeData(snapshotName, originalName);
      successNotifications.push({
        message: 'Successfully restored snapshot to live data.',
        title: 'Success!',
        color: 'green',
      });
      return {
        status: 'SUCCESS',
        notifications: successNotifications,
      };
    } catch (error) {
      console.error('Error trying to delete a snapshot', error);
      return {
        status: 'FAILED',
        error: {
          title: 'Failed to restore a snapshot fully.',
          message:
            'There was an unspecified error when trying to restore this snapshot.',
        },
      };
    }
  }

  // Renames a snapshot in the metadata
  async renameSnapshot(
    key: string,
    newName: string,
    studyId: string,
  ): Promise<ActionResponse> {
    try {
      await this._changeDirectoryNameInSnapshots(key, newName, studyId);
      return {
        status: 'SUCCESS',
        notifications: [
          {
            message: 'Successfully renamed snapshot.',
            title: 'Success!',
            color: 'green',
          },
        ],
      };
    } catch (error) {
      console.error('Error renaming collection in metadata', error);
      return {
        status: 'FAILED',
        error: {
          title: 'Failed to Rename Snapshot.',
          message: 'There was an error when trying to rename the snapshot.',
        },
      };
    }
  }
}

export type UserManagementData = { authentication?: { isEnabled: boolean }; adminUsers?: { adminUsersList: StoredUser[] } };

// A StorageEngine that is specifically designed to work with cloud storage solutions like Firebase, Supabase, etc.
// It extends the StorageEngine class and provides additional methods for cloud storage operations (such as authentication, snapshots, etc.).
export abstract class CloudStorageEngine extends StorageEngine {
  protected cloudEngine = true;

  protected userManagementData: UserManagementData = {};

  /*
  * PRIMITIVE METHODS
  * These methods are provided by the storage engine implementation and are used by the higher-level methods.
  */
  /* User management ----------------------------------------------------- */
  // Gets the user management data for the given key. This is used to get the authentication state or admin users list.
  abstract getUserManagementData<T extends 'authentication' | 'adminUsers'>(key: T): Promise<(T extends 'authentication' ? { isEnabled: boolean } : { adminUsersList: StoredUser[] }) | undefined>;

  // Updates the user management data for the given key. This is used to update the authentication state or admin users list.
  protected abstract _updateAdminUsersList(adminUsers: { adminUsersList: StoredUser[] }): Promise<void>;

  // Changes the authentication state of the storage engine. This will enable or disable authentication for the storage engine.
  abstract changeAuth(bool: boolean): Promise<void>;

  // Adds an admin user to the storage engine. The user is identified by their email and UID.
  abstract addAdminUser(user: StoredUser): Promise<void>;

  // Removes the admin user with the given email from the storage engine.
  abstract removeAdminUser(email: string): Promise<void>;

  abstract login(): Promise<StoredUser | null | void>;

  abstract unsubscribe(callback: (user: StoredUser | null) => Promise<void>): () => void;

  abstract logout(): Promise<void>;

  /*
  * HIGHER-LEVEL METHODS
  * These methods are used by the application to interact with the storage engine and provide consistent behavior across different storage engines.
  * They are built on top of the primitive methods and provide a more user-friendly interface.
  */
  /* User management --------------------------------------------------- */
  // Gets the user management data for the given key. This is used to get the authentication
  async validateUser(user: UserWrapped | null, refresh = false) {
    if (refresh) {
      this.userManagementData = {};
    }

    if (user?.user) {
      // Case 1: Database exists
      const authInfo = await this.getUserManagementData('authentication');
      if (authInfo?.isEnabled) {
        const adminUsers = await this.getUserManagementData('adminUsers');
        if (adminUsers && adminUsers.adminUsersList) {
          const adminUsersObject = Object.fromEntries(
            adminUsers.adminUsersList.map((storedUser: StoredUser) => [
              storedUser.email,
              storedUser.uid,
            ]),
          );
          // Verifies that, if the user has signed in and thus their UID is added to the Firestore, that the current UID matches the Firestore entries UID. Prevents impersonation (otherwise, users would be able to alter email to impersonate).
          const isAdmin = user.user.email
            && (adminUsersObject[user.user.email] === user.user.uid
              || adminUsersObject[user.user.email] === null);
          if (isAdmin) {
            // Add UID to user in collection if not existent.
            if (user.user.email && adminUsersObject[user.user.email] === null) {
              const adminUser: StoredUser | undefined = adminUsers.adminUsersList.find(
                (u: StoredUser) => u.email === user.user!.email,
              );
              if (adminUser) {
                adminUser.uid = user.user.uid;
              }
              await this._updateAdminUsersList(adminUsers);
            }
            return true;
          }
          return false;
        }
      }
      return true;
    }
    return false;
  }
}
