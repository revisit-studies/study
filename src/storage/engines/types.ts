import { User } from '@firebase/auth';
import { Timestamp } from 'firebase/firestore';
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
  timestamp: Timestamp | number; // Use Timestamp for Firebase, number for local storage
  rejected: boolean;
  claimed: boolean;
  completed: Timestamp | number | null;
  createdTime: Timestamp | number;
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
    : object; // Fallback for any random string

export abstract class StorageEngine {
  protected engine: string;

  protected cloudEngine: boolean = false;

  protected connected = false;

  protected localForage = localforage.createInstance({
    name: 'revisitMetadata',
  });

  protected collectionPrefix = import.meta.env.DEV ? 'dev-' : 'prod-';

  protected studyId: string | undefined;

  protected currentParticipantId: string | undefined;

  protected participantData: ParticipantData | undefined;

  constructor(engine: string) {
    this.engine = engine;
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
  // Sets the current config hash in the storage engine using the engine's realtime database.
  protected abstract _setCurrentConfigHash(configHash: string): Promise<void>;

  // Gets the current config hash from the storage engine using the engine's realtime database.
  protected abstract _getCurrentConfigHash(): Promise<string>;

  // Verifies that the realtime study database and storage is set up correctly.
  protected abstract _verifyStudyDatabase(): Promise<void>;

  /* General/Realtime ---------------------------------------------------- */
  // Sets the participant to completed in the sequence assignments in the realtime database.
  abstract _setCompletedRealtime(): Promise<void>;

  // Look through sequence assignments to find the current sequence for the participant. This should reuse a returned sequence to help ensure balanced assignments.
  abstract _getSequence(): Promise<{creationIndex: number, currentRow: Sequence}>;

  // Sets up the study database (firestore, indexedDB, etc.) for the given studyId. Also sets the studyId in the storage engine.
  abstract initializeStudyDb(studyId: string): Promise<void>;

  // Connects to the storage engine. This method might not need to do anything for some storage engines, but it is required for consistency.
  // It should set the `connected` property to true if the connection is successful.
  abstract connect(): Promise<void>;

  // Gets the modes for the given studyId. The modes are stored as a record with the mode name as the key and a boolean value indicating whether the mode is enabled or not.
  abstract getModes(studyId: string): Promise<Record<REVISIT_MODE, boolean>>;

  // Sets the mode for the given studyId. The mode is stored as a record with the mode name as the key and a boolean value indicating whether the mode is enabled or not.
  abstract setMode(studyId: string, mode: REVISIT_MODE, value: boolean): Promise<void>;

  // Gets all participant IDs for the given studyId
  abstract getAllParticipantIds(): Promise<string[]>;

  // Rejects the participant in the realtime database sequence assignments.
  abstract _rejectParticipantRealtime(participantId: string): Promise<void>;

  // Gets the audio URL for the given task and participantId. This method is used to fetch the audio file from the storage engine.
  abstract _getAudioUrl(task: string, participantId?: string): Promise<string | null>;

  // Gets the status counts for participants in the given studyId from the realtime sequence assignments.
  abstract getParticipantsStatusCounts(studyId: string): Promise<{completed: number; rejected: number; inProgress: number; minTime: Timestamp | number | null; maxTime: Timestamp | number | null}>;

  /*
  * THROTTLED METHODS
  * These methods are used to throttle the calls to the storage engine's methods that can be called frequently.
  */
  private __throttleVerifyStudyDatabase = throttle(async () => { await this._verifyStudyDatabase(); }, 10000);

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
    const allConfigs = tempHashes.map((singleHash) => [singleHash, this._getFromStorage(`configs/${singleHash}`, 'config', studyId)]);
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
    const currentParticipantId = await this.localForage.getItem(
      'currentParticipantId',
    );
    if (currentParticipantId) {
      this.currentParticipantId = currentParticipantId as string;
      return currentParticipantId as string;
    }

    // Else, generate new participant id and save it in localForage
    this.currentParticipantId = uuidv4();
    await this.localForage.setItem(
      'currentParticipantId',
      this.currentParticipantId,
    );

    return this.currentParticipantId;
  }

  // Clears the current participant ID from localForage and resets the currentParticipantId property.
  // This is used in the next participant logic and triggers a reload after clearing the participant ID.
  async clearCurrentParticipantId() {
    this.currentParticipantId = undefined;
    return await this.localForage.removeItem('currentParticipantId');
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

    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    participantData.participantTags = [...new Set([...participantData.participantTags, ...tags])];

    await this._pushToStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
      participantData,
    );
  }

  // Removes participant tags from the current participant.
  async removeParticipantTags(tags: string[]): Promise<void> {
    await this.verifyStudyDatabase();

    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    participantData.participantTags = participantData.participantTags.filter((tag) => !tags.includes(tag));

    await this._pushToStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
      participantData,
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

  // Gets all participant IDs for the current studyId or a provided studyId.
  async getAllParticipantsData(studyId?: string) {
    await this.verifyStudyDatabase();

    const participantIds = await this.getAllParticipantIds();
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

  // The actual logic to save the answers to storage, called by the throttled saveAnswers method
  async _saveAnswers() {
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

        await this._setCompletedRealtime();
      }

      return true;
    }

    return false;
  }

  // Gets the audio for a specific task and participantId.
  async getAudio(
    task: string,
    participantId: string,
  ) {
    const url = await this._getAudioUrl(task, participantId);
    if (!url) {
      return null;
    }

    const allAudioList = new Promise<string>((resolve) => {
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

    return allAudioList;
  }

  // Saves the audio stream to the storage engine. This method is used to save the audio data from a MediaRecorder stream.
  async saveAudio(
    audioStream: MediaRecorder,
    taskName: string,
  ) {
    let debounceTimeout: NodeJS.Timeout | null = null;

    const listener = async (data: BlobEvent) => {
      if (debounceTimeout) {
        return;
      }

      debounceTimeout = setTimeout(async () => {
        await this._pushToStorage(`/audio/${this.currentParticipantId}`, taskName, data.data);
        await this._cacheStorageObject(`/audio/${this.currentParticipantId}`, taskName);
      }, 500);
    };

    audioStream.addEventListener('dataavailable', listener);
    audioStream.requestData();

    // Don't clean up the listener. The stream will be destroyed.
  }

  // Sets the sequence array in the storage engine.
  async setSequenceArray(latinSquare: Sequence[]) {
    await this.verifyStudyDatabase();

    await this._pushToStorage('', 'sequenceArray', latinSquare);
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
}

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
export interface SnapshotNameItem {
  originalName: string;
  alternateName: string | null;
}

export type UserManagementData = { authentication?: { isEnabled: boolean }; adminUsers?: { adminUsersList: StoredUser[] } };

// A StorageEngine that is specifically designed to work with cloud storage solutions like , Supabase, etc.
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
  abstract _updateAdminUsersList(adminUsers: { adminUsersList: StoredUser[] }): Promise<void>;

  // Changes the authentication state of the storage engine. This will enable or disable authentication for the storage engine.
  abstract changeAuth(bool: boolean): Promise<void>;

  // Adds an admin user to the storage engine. The user is identified by their email and UID.
  abstract addAdminUser(user: StoredUser): Promise<void>;

  // Removes the admin user with the given email from the storage engine.
  abstract removeAdminUser(email: string): Promise<void>;

  /* Snapshots ----------------------------------------------------------- */
  // Gets all snapshots for the given studyId. This will return an array of objects with the original name and alternate name (if available) of the snapshots.
  abstract getSnapshots(studyId: string): Promise<SnapshotNameItem[]>;

  // Checks if the storage directory for the given source exists.
  abstract _directoryExists(source: string): Promise<boolean>;

  // Copies a storage directory and all its contents.
  abstract _copyDirectory(source: string, target: string): Promise<void>;

  // Deletes a storage directory and all its contents.
  abstract _deleteDirectory(target: string): Promise<void>;

  // Copies the realtime data from the source to the target. This is used by createSnapshot to copy the realtime data associated with a snapshot.
  abstract _copyRealtimeData(source: string, target: string): Promise<void>;

  // Deletes the realtime data for the given target. This is used by removeSnapshotOrLive to delete the realtime data associated with a snapshot or live data.
  abstract _deleteRealtimeData(target: string): Promise<void>;

  // Adds a directory name to the metadata. This is used by createSnapshot
  abstract _addDirectoryNameToMetadata(target: string): Promise<void>;

  // Removes a snapshot from the metadata. This is used by removeSnapshotOrLive
  abstract _removeNameFromMetadata(target: string): Promise<void>;

  // Updates a snapshot in the metadata. This is used by renameSnapshot
  abstract _changeNameInMetadata(oldName: string, newName: string): Promise<void>;

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

  /* Snapshots --------------------------------------------------------- */
  // Creates a snapshot of the current study data. This will copy the current study data to a new directory with a timestamp.
  async createSnapshot(
    studyId: string,
    deleteData: boolean,
  ): Promise<ActionResponse> {
    const sourceName = `${this.collectionPrefix}${studyId}`;

    if (!(await this._directoryExists(sourceName))) {
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

    await this._copyDirectory(`${sourceName}/configs`, `${targetName}/configs`);
    await this._copyDirectory(
      `${sourceName}/participants`,
      `${targetName}/participants`,
    );
    await this._copyDirectory(sourceName, targetName);
    await this._copyRealtimeData(sourceName, targetName);
    await this._addDirectoryNameToMetadata(targetName);

    const createSnapshotSuccessNotifications: RevisitNotification[] = [];
    if (deleteData) {
      const removeSnapshotResponse = await this.removeSnapshotOrLive(
        sourceName,
        false,
      );
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
    includeMetadata: boolean,
  ): Promise<ActionResponse> {
    try {
      const targetNameWithPrefix = targetName.startsWith(this.collectionPrefix)
        ? targetName
        : `${this.collectionPrefix}${targetName}`;

      await this._deleteDirectory(`${targetNameWithPrefix}/configs`);
      await this._deleteDirectory(`${targetNameWithPrefix}/participants`);
      await this._deleteDirectory(targetNameWithPrefix);
      await this._deleteRealtimeData(targetNameWithPrefix);

      if (includeMetadata) {
        await this._removeNameFromMetadata(targetNameWithPrefix);
      }
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
    oldName: string,
    newName: string,
  ): Promise<ActionResponse> {
    try {
      await this._changeNameInMetadata(oldName, newName);
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
