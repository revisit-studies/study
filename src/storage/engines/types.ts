import { User } from '@firebase/auth';
import { Timestamp } from 'firebase/firestore';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import throttle from 'lodash.throttle';
import { StudyConfig } from '../../parser/types';
import { ParticipantMetadata, Sequence } from '../../store/types';
import { ParticipantData } from '../types';
import { hash, isParticipantData } from './utils';

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

  protected connected = false;

  protected localForage = localforage.createInstance({
    name: 'revisitMetadata',
  });

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

  abstract getAllParticipantNames(): Promise<string[]>;

  abstract validateUser(user: UserWrapped | null, refresh?: boolean): Promise<boolean>;

  abstract _rejectParticipantRealtime(participantId: string): Promise<void>;

  abstract _getAudioUrl(task: string, participantId?: string): Promise<string | null>;

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

  async getAllConfigsFromHash(tempHashes: string[], studyId: string) {
    const allConfigs = tempHashes.map((singleHash) => [singleHash, this._getFromStorage(`configs/${singleHash}`, 'config', studyId)]);
    const configs = (await Promise.all(allConfigs)) as [string, StudyConfig][];
    return Object.fromEntries(configs);
  }

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

  async getParticipantTags(): Promise<string[]> {
    await this.verifyStudyDatabase();

    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    return participantData.participantTags;
  }

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

  async rejectCurrentParticipant(reason: string) {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    return await this.rejectParticipant(this.currentParticipantId, reason);
  }

  async getAllParticipantsData(studyId?: string) {
    await this.verifyStudyDatabase();

    const participantIds = await this.getAllParticipantNames();
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

    // Push the updated participant data to Firebase
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

  async setSequenceArray(latinSquare: Sequence[]) {
    await this.verifyStudyDatabase();

    await this._pushToStorage('', 'sequenceArray', latinSquare);
  }

  async getSequenceArray() {
    await this.verifyStudyDatabase();

    const sequenceArrayDocData = await this._getFromStorage(
      '',
      'sequenceArray',
    );

    return Array.isArray(sequenceArrayDocData) ? sequenceArrayDocData : null;
  }
}

// A StorageEngine that is specifically designed to work with cloud storage solutions like Firebase, Supabase, etc.
// It extends the StorageEngine class and provides additional methods for cloud storage operations (such as authentication, snapshots, etc.).
export abstract class CloudStorageEngine extends StorageEngine {

}
