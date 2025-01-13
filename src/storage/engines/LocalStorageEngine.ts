import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { REVISIT_MODE, StorageEngine, UserWrapped } from './StorageEngine';
import { ParticipantData } from '../types';
import { ParticipantMetadata, Sequence, StoredAnswer } from '../../store/types';
import { hash } from './utils';
import { StudyConfig } from '../../parser/types';

export class LocalStorageEngine extends StorageEngine {
  private studyDatabase: LocalForage | undefined = undefined;

  private studyId: string | undefined = undefined;

  constructor() {
    super('localStorage');
  }

  async connect() {
    this.connected = true;
  }

  async initializeStudyDb(studyId: string, config: StudyConfig) {
    // Create or retrieve database for study
    this.studyId = studyId;
    this.studyDatabase = await localforage.createInstance({
      name: studyId,
    });
    const currentConfigHash = await this.getCurrentConfigHash();
    const participantConfigHash = await hash(JSON.stringify(config));

    // Clear sequence array and current participant data if the config has changed
    if (currentConfigHash && currentConfigHash !== participantConfigHash) {
      await this.studyDatabase.removeItem('sequenceArray');
      await this.clearCurrentParticipantId();
    }

    this.studyDatabase.setItem('currentConfigHash', participantConfigHash);

    // Add the config to the database
    const allConfigs = await this.studyDatabase.getItem('configs') as object;
    await this.studyDatabase.setItem('configs', {
      ...allConfigs,
      [participantConfigHash]: config,
    });
  }

  getAudio(taskList: string, participantId?: string | undefined) {
    console.warn('not yet implemented', participantId);
    return Promise.resolve(undefined);
  }

  async saveAudio(audioStream: MediaRecorder): Promise<void> {
    console.warn('not yet implemented', audioStream);
    return Promise.resolve();
  }

  async initializeParticipantSession(studyId: string, searchParams: Record<string, string>, config: StudyConfig, metadata: ParticipantMetadata, urlParticipantId?: string) {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    // Ensure participantId
    await this.getCurrentParticipantId(urlParticipantId);
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Check if the participant has already been initialized
    const participant: ParticipantData | null = await this.studyDatabase.getItem(this.currentParticipantId);
    if (participant) {
      // Participant already initialized
      return participant;
    }

    // Get modes
    const modes = await this.getModes(studyId);

    // Initialize participant
    const participantConfigHash = await hash(JSON.stringify(config));
    const participantData: ParticipantData = {
      participantId: this.currentParticipantId,
      participantConfigHash,
      sequence: await this.getSequence(),
      answers: {},
      searchParams,
      metadata,
      completed: false,
      rejected: false,
      participantTags: [],
    };

    if (modes.dataCollectionEnabled) {
      await this.studyDatabase?.setItem(this.currentParticipantId, participantData);
    }

    return participantData;
  }

  async getCurrentConfigHash() {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    return await this.studyDatabase.getItem('currentConfigHash') as string;
  }

  async getAllConfigsFromHash(hashes: string[], studyId: string): Promise<Record<string, StudyConfig>> {
    const currStudyDatabase = localforage.createInstance({
      name: studyId,
    });

    const allConfigs: Record<string, StudyConfig> = await currStudyDatabase.getItem('configs') || {};

    return allConfigs;
  }

  async getCurrentParticipantId(urlParticipantId?: string) {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    // Check the database for a participantId
    const currentParticipantId = await this.studyDatabase.getItem('currentParticipant');

    // Prioritize urlParticipantId, then currentParticipantId, then generate a new participantId
    if (urlParticipantId) {
      this.currentParticipantId = urlParticipantId;
      await this.studyDatabase.setItem('currentParticipant', urlParticipantId);
      return urlParticipantId;
    } if (currentParticipantId) {
      this.currentParticipantId = currentParticipantId as string;
      return currentParticipantId as string;
    }
    const newParticipantId = uuidv4();
    await this.studyDatabase.setItem('currentParticipant', newParticipantId);
    this.currentParticipantId = newParticipantId;
    return newParticipantId;
  }

  async clearCurrentParticipantId() {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    await this.studyDatabase.removeItem('currentParticipant');
  }

  async saveAnswers(answers: Record<string, StoredAnswer>) {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Get participant data
    const participant: ParticipantData | null = await this.studyDatabase.getItem(this.currentParticipantId);
    if (!participant) {
      throw new Error('Participant not initialized');
    }

    // Save answer
    participant.answers = answers;
    await this.studyDatabase.setItem(this.currentParticipantId, participant);
  }

  async setSequenceArray(sequenceArray: Sequence[]) {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    this.studyDatabase.setItem('sequenceArray', sequenceArray);
  }

  async getSequence() {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    // Get the latin square
    const sequenceArray: Sequence[] | null = await this.studyDatabase.getItem('sequenceArray');
    if (!sequenceArray) {
      throw new Error('Latin square not initialized');
    }

    // Get modes
    if (!this.studyId) {
      throw new Error('Study ID not initialized');
    }
    const modes = await this.getModes(this.studyId);

    // Get the current row or random if data collection is disabled
    const currentRow = modes.dataCollectionEnabled
      ? sequenceArray.pop()
      : sequenceArray[Math.floor(Math.random() * sequenceArray.length - 1)];
    if (!currentRow) {
      throw new Error('Latin square is empty');
    }

    // Update the latin square
    if (modes.dataCollectionEnabled) {
      await this.studyDatabase.setItem('sequenceArray', sequenceArray);
    }

    return currentRow;
  }

  async getSequenceArray() {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    return await this.studyDatabase.getItem('sequenceArray') as Sequence[] | null;
  }

  async getAllParticipantsData() {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    const returnArray: ParticipantData[] = [];

    await this.studyDatabase.iterate((value, key) => {
      if (key !== 'config' && key !== 'currentParticipant' && key !== 'sequenceArray' && key !== 'configs' && key !== 'currentConfigHash' && key !== 'modes') {
        returnArray.push(value as ParticipantData);
      }
    });

    return returnArray;
  }

  async getAllParticipantsDataByStudy(studyId: string) {
    const currStudyDatabase = localforage.createInstance({
      name: studyId,
    });

    const returnArray: ParticipantData[] = [];

    await currStudyDatabase.iterate((value, key) => {
      if (key !== 'config' && key !== 'currentParticipant' && key !== 'sequenceArray' && key !== 'configs' && key !== 'currentConfigHash' && key !== 'modes') {
        returnArray.push(value as ParticipantData);
      }
    });

    return returnArray;
  }

  async getParticipantData(participantIdInput?: string) {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    const participantId = participantIdInput || await this.studyDatabase.getItem('currentParticipant') as string | null;
    if (!participantId) {
      return null;
    }

    return await this.studyDatabase.getItem(participantId) as ParticipantData | null;
  }

  async getParticipantTags(): Promise<string[]> {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    return participantData.participantTags;
  }

  async addParticipantTags(tags: string[]): Promise<void> {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    participantData.participantTags = [...new Set([...participantData.participantTags, ...tags])];
    await this.studyDatabase.setItem(this.currentParticipantId as string, participantData);
  }

  async removeParticipantTags(tags: string[]): Promise<void> {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    participantData.participantTags = participantData.participantTags.filter((tag) => !tags.includes(tag));
    await this.studyDatabase.setItem(this.currentParticipantId as string, participantData);
  }

  async nextParticipant() {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    // Generate a new participant id
    const newParticipantId = uuidv4();

    // Set current participant id
    await this.studyDatabase.setItem('currentParticipant', newParticipantId);
  }

  async verifyCompletion() {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    // Get the participantData
    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    if (participantData.completed) {
      return true;
    }

    // Set the participant as completed
    participantData.completed = true;

    // Save the participantData
    await this.studyDatabase.setItem(this.currentParticipantId as string, participantData);

    return true;
  }

  async validateUser(_: UserWrapped | null) {
    return true;
  }

  async rejectParticipant(studyId: string, participantId: string, reason: string) {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    // Get the user from storage
    const participant = await this.studyDatabase.getItem(participantId) as ParticipantData | null;

    if (!participant) {
      throw new Error('Participant not found');
    }

    // If the user is already rejected, return
    if (participant.rejected) {
      return;
    }

    // Set the user as rejected
    participant.rejected = {
      reason,
      timestamp: new Date().getTime(),
    };

    // Return the user's sequence to the pool
    const sequenceArray = await this.studyDatabase.getItem('sequenceArray') as Sequence[] | null;
    if (sequenceArray) {
      sequenceArray.unshift(participant.sequence);
      this.setSequenceArray(sequenceArray);
    }

    // Save the user
    await this.studyDatabase.setItem(participantId, participant);
  }

  async rejectCurrentParticipant(studyId: string, reason: string) {
    if (!this._verifyStudyDatabase(this.studyDatabase)) {
      throw new Error('Study database not initialized');
    }

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    await this.rejectParticipant(studyId, this.currentParticipantId, reason);
  }

  async setMode(studyId: string, key: REVISIT_MODE, value: boolean) {
    // Create or retrieve database for study
    this.studyDatabase = await localforage.createInstance({
      name: studyId,
    });

    // Get the modes
    const modes = await this.studyDatabase.getItem('modes') as Record<REVISIT_MODE, boolean> | null;
    if (!modes) {
      throw new Error('Modes not initialized');
    }

    // Set the mode
    modes[key] = value;
    this.studyDatabase.setItem('modes', modes);
  }

  async getModes(studyId: string) {
    // Create or retrieve database for study
    this.studyDatabase = await localforage.createInstance({
      name: studyId,
    });

    // Get the modes
    const modes = await this.studyDatabase.getItem('modes') as Record<REVISIT_MODE, boolean> | null;
    if (modes) {
      return modes;
    }

    // Else, set and return defaults
    const defaults: Record<REVISIT_MODE, boolean> = {
      dataCollectionEnabled: true,
      studyNavigatorEnabled: true,
      analyticsInterfacePubliclyAccessible: true,
    };
    this.studyDatabase.setItem('modes', defaults);
    return defaults;
  }

  async getParticipantsStatusCounts(studyId: string) {
    const participants = await this.getAllParticipantsDataByStudy(studyId);

    const completed = participants.filter((p) => p.completed && !p.rejected).length;
    const rejected = participants.filter((p) => p.rejected).length;
    const inProgress = participants.filter((p) => !p.completed && !p.rejected).length;

    const minTime = Math.min(...participants.map((p) => Math.min(...Object.values(p.answers).map((s) => s.startTime))));
    const maxTime = Math.max(...participants.map((p) => Math.max(...Object.values(p.answers).map((s) => s.endTime))));

    return {
      completed,
      rejected,
      inProgress,
      minTime: minTime === Infinity ? null : minTime,
      maxTime: maxTime === -Infinity ? null : maxTime,
    };
  }

  private _verifyStudyDatabase(db: LocalForage | undefined): db is LocalForage {
    return db !== undefined;
  }
}
