import { Timestamp } from 'firebase/firestore';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { throttle } from 'lodash';
import { StudyConfig } from '../../parser/types';
import { ParticipantMetadata, Sequence } from '../../store/types';
import { ParticipantData } from '../types';
import {
  REVISIT_MODE, ServerStorageEngine, StorageObject, StorageObjectType, UserWrapped,
} from './types';
import { hash, isParticipantData } from './utils';

export class SupabaseStorageEngine extends ServerStorageEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any, 'public', any>;

  private studyId = '';

  private participantData: ParticipantData | null = null;

  private localForage = localforage.createInstance({
    name: 'currentParticipantId',
  });

  constructor() {
    super('supabase');

    // Initialize Supabase client here
    this.supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  }

  async connect() {
    return new Promise<void>((resolve, reject) => {
      // Check if the Supabase client is connected
      if (this.supabase) {
        this.connected = true;
        resolve();
      } else {
        console.error('Failed to connect to Supabase');
        reject(new Error('Failed to connect to Supabase'));
      }
    });
  }

  async initializeStudyDb(studyId: string, config: StudyConfig): Promise<void> {
    const { error } = await this.supabase.auth.signInAnonymously();

    // Write a row into the revisit table for the study
    const { error: schemaError } = await this.supabase
      .from('revisit')
      .insert({
        database: studyId,
        data: {},
      });
    this.studyId = studyId;

    // Error if login failed or if there was a SQL issue that was not a duplicate record
    // (23505 is the code for unique constraint violation in PostgreSQL)
    if (error || (schemaError && schemaError.code !== '23505')) {
      // console.error('Error initializing study DB:', error || schemaError);
      // throw new Error('Failed to initialize study DB');
    }

    const currentConfigHash = await this.getCurrentConfigHash();
    // Hash the config
    const configHash = await hash(JSON.stringify(config));
    // Push the config to the storage
    await this._pushToStorage(
      `configs/${configHash}`,
      'config',
      config,
      true,
    );

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

  async initializeParticipantSession(
    studyId: string,
    searchParams: Record<string, string>,
    config: StudyConfig,
    metadata: ParticipantMetadata,
    urlParticipantId?: string,
  ) {
    if (!this._verifyStudyDatabase()) {
      throw new Error('Study database not initialized');
    }

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

    // Get modes
    const modes = await this.getModes(studyId);

    if (isParticipantData(participant)) {
      this.participantData = participant;
      return participant;
    }

    const participantConfigHash = await hash(JSON.stringify(config));
    const { currentRow, creationIndex } = await this.getSequence();
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
      // Push the participant data to the storage
      await this._pushToStorage(
        `participants/${this.currentParticipantId}`,
        'participantData',
        this.participantData,
      );
    }

    return this.participantData;
  }

  async getCurrentConfigHash() {
    if (!this._verifyStudyDatabase()) {
      throw new Error('Study database not initialized');
    }
    // get the config hash from the study collection
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('database', this.studyId);
    if (error || data.length === 0) {
      console.error('Error getting current config hash:', error);
      throw new Error('Failed to get current config hash');
    }
    const { configHash } = data[0].data;
    if (!configHash) {
      return null;
    }
    return configHash;
  }

  getAllConfigsFromHash(hashes: string[], studyId: string): Promise<Record<string, StudyConfig>> {
    throw new Error('Method not implemented.');
  }

  async getCurrentParticipantId(urlParticipantId?: string) {
    // Get currentParticipantId from localForage
    const currentParticipantId = await this.localForage.getItem(
      'currentParticipantId',
    );

    // Prioritize urlParticipantId, then currentParticipantId, then generate a new participantId
    if (urlParticipantId) {
      this.currentParticipantId = urlParticipantId;
      await this.localForage.setItem('currentParticipantId', urlParticipantId);
      return urlParticipantId;
    }
    if (currentParticipantId) {
      this.currentParticipantId = currentParticipantId as string;
      return currentParticipantId as string;
    }
    // Create new participant doc inside study collection and get the currentParticipantId from that new participant
    if (!this._verifyStudyDatabase()) {
      throw new Error('Study database not initialized');
    }

    // Generate new participant id
    this.currentParticipantId = uuidv4();

    // Set currentParticipantId in localForage
    await this.localForage.setItem(
      'currentParticipantId',
      this.currentParticipantId,
    );

    return this.currentParticipantId;
  }

  clearCurrentParticipantId(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private throttleSaveAnswers = throttle(async () => { await this._saveAnswers(); }, 3000);

  async saveAnswers(answers: ParticipantData['answers']) {
    if (!this.currentParticipantId || this.participantData === null) {
      throw new Error('Participant not initialized');
    }
    // Update the local copy of the participant data
    this.participantData = {
      ...this.participantData,
      answers,
    };

    await this.throttleSaveAnswers(answers);
  }

  async _saveAnswers() {
    if (!this._verifyStudyDatabase()) {
      throw new Error('Study database not initialized');
    }

    if (!this.currentParticipantId || this.participantData === null) {
      throw new Error('Participant not initialized');
    }

    // Push the updated participant data to Firebase
    await this._pushToStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
      this.participantData,
    );
  }

  async setSequenceArray(latinSquare: Sequence[]) {
    if (!this._verifyStudyDatabase()) {
      throw new Error('Study database not initialized');
    }
    // set the sequence array in the study collection by patching the document
    await this._pushToStorage(
      '',
      'sequenceArray',
      latinSquare,
    );
  }

  async getSequenceArray() {
    if (!this._verifyStudyDatabase()) {
      throw new Error('Study database not initialized');
    }
    // get the sequence array from the study storage
    const sequenceArray = await this._getFromStorage(
      '',
      'sequenceArray',
    );
    return Array.isArray(sequenceArray) ? sequenceArray : null;
  }

  async getSequence() {
    // TODO: fix

    const sequenceArray = await this.getSequenceArray();
    if (!sequenceArray) {
      throw new Error('Sequence array not found');
    }
    const selectedIndex = 0;
    const currentRow = sequenceArray[selectedIndex];
    const creationIndex = selectedIndex + 1;
    return { creationIndex, currentRow };
  }

  getAllParticipantsData(): Promise<ParticipantData[]> {
    throw new Error('Method not implemented.');
  }

  getAllParticipantsDataByStudy(studyId: string): Promise<ParticipantData[]> {
    throw new Error('Method not implemented.');
  }

  getParticipantData(participantid?: string): Promise<ParticipantData | null> {
    throw new Error('Method not implemented.');
  }

  getParticipantTags(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  addParticipantTags(tags: string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getAllParticipantNames(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  removeParticipantTags(tags: string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  nextParticipant(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  verifyCompletion(answers: ParticipantData['answers']): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  validateUser(user: UserWrapped | null, refresh?: boolean): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  saveAudio(audioStream: MediaRecorder, taskName: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  rejectParticipant(studyId: string, participantID: string, reason: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  rejectCurrentParticipant(studyId: string, reason: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setMode(studyId: string, mode: REVISIT_MODE, value: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getAudio(task: string, participantId?: string): Promise<string | undefined> {
    throw new Error('Method not implemented.');
  }

  async getModes(studyId: string) {
    if (!this._verifyStudyDatabase()) {
      throw new Error('Study database not initialized');
    }
    // get the modes from the study collection
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('database', studyId);
    if (error || data.length === 0) {
      console.error('Error getting modes:', error);
      throw new Error('Failed to get modes');
    }
    // get the metadata field from the data object
    const { metadata } = data[0].data;
    if (metadata) {
      return metadata;
    }

    const defaultModes = {
      dataCollectionEnabled: true,
      studyNavigatorEnabled: true,
      analyticsInterfacePubliclyAccessible: true,
    };
    await this.supabase
      .from('revisit')
      .update({ data: { metadata: defaultModes } })
      .eq('database', studyId);
    return defaultModes;
  }

  getParticipantsStatusCounts(studyId: string): Promise<{ completed: number; rejected: number; inProgress: number; minTime: Timestamp | number | null; maxTime: Timestamp | number | null; }> {
    throw new Error('Method not implemented.');
  }

  async _setCurrentConfigHash(configHash: string) {
    if (!this._verifyStudyDatabase()) {
      throw new Error('Study database not initialized');
    }
    // set the config hash in the study collection by patching the document
    await this.supabase
      .from('revisit')
      .update({ data: { configHash } })
      .eq('database', this.studyId);
  }

  private async _verifyStudyDatabase() {
    const { data, error } = await this.supabase
      .from('revisit')
      .select('*')
      .eq('database', this.studyId);
    if (error || data.length === 0) {
      return false;
    }
    return true;
  }

  protected async _pushToStorage<T extends StorageObjectType>(
    prefix: string,
    type: T,
    objectToUpload: StorageObject<T>,
    cache?: boolean,
  ) {
    const blob = new Blob([JSON.stringify(objectToUpload)], {
      type: 'application/json',
    });
    const { error } = await this.supabase.storage
      .from('revisit')
      .upload(`${this.studyId}/${prefix}_${type}`, blob, {
        cacheControl: cache ? '3600' : '0',
        upsert: true,
      });

    if (error) {
      console.error('Error uploading to Supabase:', error);
      throw new Error('Failed to upload to Supabase');
    }
  }

  protected async _deleteFromStorage<T extends StorageObjectType>(
    prefix: string,
    type: T,
  ) {
    const { error } = await this.supabase.storage
      .from('revisit')
      .remove([`${this.studyId}/${prefix}_${type}`]);

    if (error) {
      console.error('Error deleting from Supabase:', error);
      throw new Error('Failed to delete from Supabase');
    }
  }

  protected async _getFromStorage<T extends StorageObjectType>(
    prefix: string,
    type: T,
  ): Promise<StorageObject<T> | null> {
    const { data, error } = await this.supabase.storage
      .from('revisit')
      .download(`${this.studyId}/${prefix}_${type}`);

    if (error) {
      console.error('Error downloading from Supabase:', error);
      return {} as StorageObject<T>;
    }

    const text = await data.text();
    return JSON.parse(text) as StorageObject<T>;
  }
}
