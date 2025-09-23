import { User } from '@firebase/auth';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import throttle from 'lodash.throttle';
import { StudyConfig } from '../../parser/types';
import { ParticipantMetadata, Sequence } from '../../store/types';
import { ParticipantData } from '../types';
import { hash, isParticipantData } from './utils';
import { RevisitNotification } from '../../utils/notifications';

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

export type SequenceAssignment = {
  participantId: string;
  timestamp: number; // Use Timestamp for Firebase, number for local storage
  rejected: boolean;
  claimed: boolean;
  completed: number | null;
  createdTime: number;
};

export type REVISIT_MODE = 'dataCollectionEnabled' | 'studyNavigatorEnabled' | 'analyticsInterfacePubliclyAccessible';

export type StorageObjectType = 'sequenceArray' | 'participantData' | 'config' | string;
export type StorageObject<T extends StorageObjectType> =
  T extends 'sequenceArray'
    ? Sequence[]
    : T extends 'participantData'
    ? ParticipantData
    : T extends 'config'
    ? StudyConfig
    : Blob; // Fallback for any random string

export interface CloudStorageEngineError {
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

export abstract class StorageEngine {
  protected engine: 'localStorage' | 'supabase' | 'firebase';

  protected testing: boolean;

  protected cloudEngine: boolean = false;

  protected connected = false;

  protected localForage = localforage.createInstance({
    name: 'revisit',
  });

  protected collectionPrefix = import.meta.env.DEV ? 'dev-' : 'prod-';

  protected studyId: string | undefined;

  protected currentParticipantId: string | undefined;

  protected participantData: ParticipantData | undefined;

  // Ids of assets (eg. audio/screen recording) being uploaded.
  protected uploadingAssetIds: string[] = [];

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
  protected abstract _getAllSequenceAssignments(studyId: string): Promise<SequenceAssignment[]>;

  // Creates a sequence assignment for the given participantId and sequenceAssignment. Cloud storage engines should use the realtime database to create the sequence assignment and should use the server to prevent race conditions (i.e. using server timestamps).
  protected abstract _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment, withServerTimestamp: boolean): Promise<void>;

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
  abstract getModes(studyId: string): Promise<Record<REVISIT_MODE, boolean>>;

  // Sets the mode for the given studyId. The mode is stored as a record with the mode name as the key and a boolean value indicating whether the mode is enabled or not.
  abstract setMode(studyId: string, mode: REVISIT_MODE, value: boolean): Promise<void>;

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

  private __throttleSaveAnswers = throttle(async () => { await this._saveAnswers(); }, 3000);

  /*
  * HIGHER-LEVEL METHODS
  * These methods are used by the application to interact with the storage engine and provide consistent behavior across different storage engines.
  * They are built on top of the primitive methods and provide a more user-friendly interface.
  */
  // Verify study database using provided primitive from storage engine with a throttle of 10 seconds.
  protected async verifyStudyDatabase() {
    return await this.__throttleVerifyStudyDatabase();
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

    // Clear sequence array and current participant data if the config has changed
    if (currentConfigHash && currentConfigHash !== configHash) {
      try {
        await this._deleteFromStorage('', 'sequenceArray');
      } catch {
        // pass, if this happens, we didn't have a sequence array yet
      }
      await this.clearCurrentParticipantId();
    }

    await this._setCurrentConfigHash(configHash);
  }

  // Gets all configs from the storage engine based on the provided temporary hashes and studyId.
  async getAllConfigsFromHash(tempHashes: string[], studyId: string) {
    const allConfigs = tempHashes.map(async (singleHash) => [singleHash, await this._getFromStorage(`configs/${singleHash}`, 'config', studyId)]);
    const configs = (await Promise.all(allConfigs)) as [string, StudyConfig][];
    return Object.fromEntries(configs);
  }

  // Gets the current participant ID from the URl, localForage, or generates a new one if none exists.
  async getCurrentParticipantId(urlParticipantId?: string) {
    // Prioritize urlParticipantId, don't set it in localForage so our currentParticipantId
    // is not overwritten when we leave analysis mode
    if (urlParticipantId) {
      this.currentParticipantId = urlParticipantId;
      return urlParticipantId;
    }

    // If we already have a currentParticipantId, return it
    if (this.currentParticipantId) {
      return this.currentParticipantId;
    }

    // Next check localForage for currentParticipantId
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }
    const currentParticipantId = await this.localForage.getItem(
      `${this.collectionPrefix}${this.studyId}/currentParticipantId`,
    );
    if (currentParticipantId) {
      this.currentParticipantId = currentParticipantId as string;
      return currentParticipantId as string;
    }

    // Else, generate new participant id and save it in localForage
    this.currentParticipantId = uuidv4();
    await this.localForage.setItem(
      `${this.collectionPrefix}${this.studyId}/currentParticipantId`,
      this.currentParticipantId,
    );

    return this.currentParticipantId;
  }

  // Clears the current participant ID from localForage and resets the currentParticipantId property.
  // This is used in the next participant logic and triggers a reload after clearing the participant ID.
  async clearCurrentParticipantId() {
    this.currentParticipantId = undefined;
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }
    return await this.localForage.removeItem(`${this.collectionPrefix}${this.studyId}/currentParticipantId`);
  }

  // This function is one of the most critical functions in the storage engine.
  // It uses the notion of sequence intents and assignments to determine the current sequence for the participant.
  // It handles rejected participants and allows for reusing a rejected participant's sequence.
  protected async _getSequence() {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }
    let sequenceAssignments = await this._getAllSequenceAssignments(this.studyId);

    const modes = await this.getModes(this.studyId);

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
      };
      await this._createSequenceAssignment(this.currentParticipantId, participantSequenceAssignmentData, true);
    }

    // Query all the intents to get a sequence and find our position in the queue
    sequenceAssignments = await this._getAllSequenceAssignments(this.studyId);

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

    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    // Get modes
    const modes = await this.getModes(this.studyId);

    if (isParticipantData(participant)) {
      // Participant already initialized
      this.participantData = participant;
      return participant;
    }
    // Initialize participant
    const participantConfigHash = await hash(JSON.stringify(config));
    const { currentRow, creationIndex } = await this._getSequence();
    this.participantData = {
      participantId: this.currentParticipantId,
      participantConfigHash,
      sequence: currentRow,
      participantIndex: creationIndex,
      answers: {},
      searchParams,
      metadata,
      completed: false,
      rejected: false,
      participantTags: [],
    };

    if (modes.dataCollectionEnabled) {
      await this._pushToStorage(
        `participants/${this.currentParticipantId}`,
        'participantData',
        this.participantData,
      );
    }

    return this.participantData;
  }

  // Gets all participant IDs for the given studyId
  async getAllParticipantIds(studyId?: string) {
    const studyIdToUse = this.studyId || studyId;
    if (studyIdToUse === undefined) {
      throw new Error('Study ID is not set');
    }
    const sequenceAssignments = await this._getAllSequenceAssignments(studyIdToUse);
    return sequenceAssignments.map((assignment) => assignment.participantId);
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

    return isParticipantData(participantData) ? participantData : null;
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

    await this._pushToStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
      this.participantData,
    );
  }

  // Removes participant tags from the current participant.
  async removeParticipantTags(tags: string[]): Promise<void> {
    await this.verifyStudyDatabase();

    if (!this.participantData) {
      throw new Error('Participant data not initialized');
    }
    this.participantData.participantTags = this.participantData.participantTags.filter((tag) => !tags.includes(tag));

    await this._pushToStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
      this.participantData,
    );
  }

  // Rejects a participant with the given participantId and reason.
  async rejectParticipant(participantId: string, reason: string, studyId?: string) {
    const participant = await this._getFromStorage(
      `participants/${participantId}`,
      'participantData',
      studyId,
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
  async undoRejectParticipant(participantId: string, studyId?: string) {
    const participant = await this._getFromStorage(
      `participants/${participantId}`,
      'participantData',
      studyId,
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
  async getAllParticipantsData(studyId: string) {
    const participantIds = await this.getAllParticipantIds(studyId);
    const participantsData: ParticipantData[] = [];

    const participantPulls = participantIds.map(async (participantId) => {
      const participantData = await this._getFromStorage(
        `participants/${participantId}`,
        'participantData',
        studyId,
      );

      if (isParticipantData(participantData)) {
        participantsData.push(participantData);
      }
    });

    await Promise.all(participantPulls);

    return participantsData;
  }

  async getParticipantsStatusCounts(studyId: string) {
    const sequenceAssignments = await this._getAllSequenceAssignments(studyId);

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

  // The actual logic to save the answers to storage, called by the throttled saveAnswers method
  protected async _saveAnswers() {
    await this.verifyStudyDatabase();

    if (!this.currentParticipantId || this.participantData === undefined) {
      throw new Error('Participant not initialized');
    }

    // Push the updated participant data to firebase
    await this._pushToStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
      this.participantData,
    );
  }

  // Save the answer into the local participant data and then call the throttled saveAnswers method.
  // The throttled method calls _saveAnswers which is the actual logic to save the answers to storage
  async saveAnswers(answers: ParticipantData['answers']) {
    if (!this.currentParticipantId || this.participantData === undefined) {
      throw new Error('Participant not initialized');
    }
    // Update the local copy of the participant data
    this.participantData = {
      ...this.participantData,
      answers,
    };

    await this.__throttleSaveAnswers(answers);
  }

  // Verifies if the current participant has completed the study. Checks that the throttled answers are saved and marks the participant as complete if so.
  async verifyCompletion() {
    await this.verifyStudyDatabase();

    if (!this.studyId) {
      throw new Error('Study not initialized');
    }

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Get the participantData
    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    // Check for remaining assets uploads
    const hasUploadsRemaining = this.uploadingAssetIds.length > 0;
    if (hasUploadsRemaining) {
      return false;
    }

    if (participantData.completed) {
      return true;
    }

    // Get modes
    const modes = await this.getModes(this.studyId);

    const serverEndTime = Object.values(participantData.answers).map((answer) => answer.endTime).reduce((a, b) => Math.max(a, b), 0);
    const localEndTime = Object.values(this.participantData?.answers || {}).map((answer) => answer.endTime).reduce((a, b) => Math.max(a, b), 0);
    if (this.participantData && serverEndTime === localEndTime) {
      this.participantData.completed = true;
      if (modes.dataCollectionEnabled) {
        await this._pushToStorage(
          `participants/${this.currentParticipantId}`,
          'participantData',
          this.participantData,
        );
        await this._cacheStorageObject(
          `participants/${this.currentParticipantId}`,
          'participantData',
        );

        await this._completeCurrentParticipantRealtime();
      }

      return true;
    }

    return false;
  }

  async getAsset(url:string | null) {
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
    recorder: MediaRecorder,
    taskName: string,
  ) {
    let debounceTimeout: NodeJS.Timeout | null = null;

    const assetKey = `${prefix}/${taskName}`;
    const participantKey = `${prefix}/${this.currentParticipantId}`;

    this.uploadingAssetIds.push(assetKey);

    const listener = async (data: BlobEvent) => {
      if (debounceTimeout) {
        return;
      }

      debounceTimeout = setTimeout(async () => {
        await this._pushToStorage(participantKey, taskName, data.data);
        await this._cacheStorageObject(participantKey, taskName);

        this.uploadingAssetIds = this.uploadingAssetIds.filter((id) => id !== assetKey);
      }, 500);
    };

    recorder.addEventListener('dataavailable', listener);

    // Detect Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    // When stopping recording:
    if (isSafari) {
      recorder.stop(); // This will trigger ondataavailable with the full recording
    } else {
      // For Chrome/Firefox, you can use requestData or chunked data
      recorder.requestData();
    }

    // Don't clean up the listener. The stream will be destroyed.
  }

  // Saves the audio stream to the storage engine. This method is used to save the audio data from a MediaRecorder stream.
  async saveAudio(
    audioStream: MediaRecorder,
    taskName: string,
  ) {
    return this.saveAsset('audio', audioStream, taskName);
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
    const prefix = 'screenRecording';
    const assetKey = `${prefix}/${taskName}`;
    const participantKey = `${prefix}/${this.currentParticipantId}`;

    this.uploadingAssetIds.push(assetKey);

    await this._pushToStorage(participantKey, taskName, blob);
    await this._cacheStorageObject(participantKey, taskName);

    this.uploadingAssetIds = this.uploadingAssetIds.filter((id) => id !== assetKey);
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
    this.currentParticipantId = undefined;
    this.participantData = undefined;

    this.localForage.setItem(
      `${this.collectionPrefix}${this.studyId}/currentParticipantId`,
      undefined,
    );
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
