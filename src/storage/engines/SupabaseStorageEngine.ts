import { AuthError, createClient } from '@supabase/supabase-js';
import {
  REVISIT_MODE, SequenceAssignment, SnapshotDocContent, StorageObject, StorageObjectType, StoredUser,
  CloudStorageEngine,
} from './types';

export class SupabaseStorageEngine extends CloudStorageEngine {
  private supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

  constructor(testing: boolean = false) {
    super('supabase', testing);
  }

  protected async _getFromStorage<T extends StorageObjectType>(prefix: string, type: T, studyId?: string) {
    const { data, error } = await this.supabase.storage
      .from('revisit')
      .download(`${this.collectionPrefix}${studyId || this.studyId}/${prefix}_${type}`);

    if (error) {
      return {} as StorageObject<T>;
    }

    const dataToParse = this.testing ? new Blob([data as unknown as string], { type: 'application/json' }) : data;
    try {
      const text = await dataToParse.text();
      return JSON.parse(text) as StorageObject<T>;
    } catch {
      // Return the Blob directly if parsing fails
      return dataToParse as StorageObject<T>;
    }
  }

  protected async _pushToStorage<T extends StorageObjectType>(prefix: string, type: T, objectToUpload: StorageObject<T>) {
    await this.verifyStudyDatabase();

    let uploadObject: Blob | Buffer<ArrayBuffer> = new Blob();
    if (objectToUpload instanceof Blob) {
    // Have to use buffers in testing mode
      uploadObject = this.testing ? Buffer.from(JSON.stringify(objectToUpload)) : objectToUpload;
    } else {
      uploadObject = new Blob([JSON.stringify(objectToUpload)], {
        type: 'application/json',
      });
    }

    const { error } = await this.supabase.storage
      .from('revisit')
      .upload(`${this.collectionPrefix}${this.studyId}/${prefix}_${type}`, uploadObject, {
        upsert: true,
      });

    if (error) {
      throw new Error('Failed to upload to Supabase');
    }
  }

  protected async _deleteFromStorage<T extends StorageObjectType>(prefix: string, type: T) {
    await this.verifyStudyDatabase();
    const { error } = await this.supabase.storage
      .from('revisit')
      .remove([`${this.collectionPrefix}${this.studyId}/${prefix}_${type}`]);

    if (error) {
      throw new Error('Failed to delete from Supabase');
    }
  }

  protected async _cacheStorageObject<T extends StorageObjectType>(prefix: string, type: T) {
    await this.verifyStudyDatabase();
    // Download the existing object
    const { data, error: downloadError } = await this.supabase.storage
      .from('revisit')
      .download(`${this.collectionPrefix}${this.studyId}/${prefix}_${type}`);

    if (downloadError || !data) {
      throw new Error('Failed to download object for cache update');
    }

    // Re-upload the object with the desired cache control header
    const { error: uploadError } = await this.supabase.storage
      .from('revisit')
      .upload(
        `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`,
        data,
        {
          upsert: true,
          cacheControl: '31536000', // Cache for 1 year
        },
      );

    if (uploadError) {
      throw new Error('Failed to update cache header for Supabase object');
    }
  }

  protected async _verifyStudyDatabase() {
    const { error } = await this.supabase
      .from('revisit')
      .select('*')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`);
    if (error || !this.studyId) {
      throw new Error('Study database not initialized or does not exist');
    }
  }

  protected async _getCurrentConfigHash() {
    await this.verifyStudyDatabase();
    const { data } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', 'currentConfigHash')
      .single();
    return data?.data?.configHash as string || null;
  }

  protected async _setCurrentConfigHash(configHash: string) {
    await this.verifyStudyDatabase();
    // set the config hash in the study collection by patching the document
    await this.supabase
      .from('revisit')
      .upsert({
        studyId: `${this.collectionPrefix}${this.studyId}`,
        docId: 'currentConfigHash',
        data: { configHash },
      })
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', 'currentConfigHash');
  }

  public async getAllSequenceAssignments(studyId: string) {
    // get all sequence assignments from the study collection
    const { data, error } = await this.supabase
      .from('revisit')
      // select data and created_at
      .select('data, createdAt')
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .like('docId', 'sequenceAssignment_%');
    if (error) {
      throw new Error('Failed to get sequence assignments');
    }
    return data
      .map((item) => ({
        ...item.data,
        timestamp: item.data.withServerTimestamp ? new Date(item.createdAt).getTime() : item.data.timestamp,
        createdTime: new Date(item.createdAt).getTime(),
      } as SequenceAssignment))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  protected async _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment, withServerTimestamp: boolean = false) {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    // Create a sequence assignment for the participant in the study collection
    await this.supabase
      .from('revisit')
      .upsert({
        studyId: `${this.collectionPrefix}${this.studyId}`,
        docId: `sequenceAssignment_${participantId}`,
        data: { ...sequenceAssignment, withServerTimestamp },
      })
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', `sequenceAssignment_${participantId}`);
  }

  protected async _completeCurrentParticipantRealtime() {
    await this.verifyStudyDatabase();
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    // Get the sequence assignment for the current participant
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', `sequenceAssignment_${this.currentParticipantId}`)
      .single();

    if (error || !data) {
      throw new Error('Failed to retrieve sequence assignment for current participant');
    }

    // Update the sequence assignment for the current participant to mark it as completed
    const sequenceAssignmentPath = `sequenceAssignment_${this.currentParticipantId}`;
    await this.supabase
      .from('revisit')
      .update({ data: { ...data.data, completed: new Date().getTime() } })
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', sequenceAssignmentPath);
  }

  protected async _rejectParticipantRealtime(participantId: string) {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `sequenceAssignment_${participantId}`;
    // Get the sequence assignment for the participant
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', sequenceAssignmentPath)
      .single();

    if (error || !data) {
      throw new Error('Failed to retrieve sequence assignment for current participant');
    }

    // Update the sequence assignment for the participant to mark it as rejected
    await this.supabase
      .from('revisit')
      .update({ data: { ...data.data, rejected: true, timestamp: new Date().getTime() } })
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', sequenceAssignmentPath);

    // Get the sequence assignment for the initial participant if we are rejecting a claimed assignment
    // select on data->timestamp to find the claimed assignment
    const { data: claimedData, error: claimedError } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('data->timestamp', data.data.timestamp)
      .single();

    if (claimedError || !claimedData) {
      throw new Error('Failed to retrieve claimed sequence assignment for rejection');
    }
    // Update the claimed sequence assignment to mark it as available again
    await this.supabase
      .from('revisit')
      .update({ data: { ...claimedData.data, claimed: false } })
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', `sequenceAssignment_${claimedData.data.participantId}`);
  }

  protected async _undoRejectParticipantRealtime(participantId: string) {
    await this.verifyStudyDatabase();
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `sequenceAssignment_${participantId}`;
    // Get the sequence assignment for the participant
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', sequenceAssignmentPath)
      .single();

    if (error || !data) {
      throw new Error('Failed to retrieve sequence assignment for current participant');
    }

    // Update the sequence assignment for the participant to mark it as un-rejected
    await this.supabase
      .from('revisit')
      .update({ data: { ...data.data, rejected: false } })
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', sequenceAssignmentPath);
  }

  protected async _claimSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment) {
    await this.verifyStudyDatabase();
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `sequenceAssignment_${participantId}`;
    // Update the sequence assignment for the participant to mark it as claimed
    await this.supabase
      .from('revisit')
      .update({ data: { ...sequenceAssignment, claimed: true } })
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', sequenceAssignmentPath);
  }

  async initializeStudyDb(studyId: string) {
    // Check if we have a session
    let error: AuthError | null = null;
    const { data } = await this.getSession();
    if (!data.session) {
      const { error: authError } = await this.supabase.auth.signInAnonymously();
      if (authError) {
        error = authError;
        console.error('Error signing in anonymously:', error);
        throw new Error('Failed to sign in anonymously');
      }
    }

    // Write a row into the revisit table for the study
    const { error: schemaError } = await this.supabase
      .from('revisit')
      .upsert({
        studyId: `${this.collectionPrefix}${studyId}`,
        docId: 'connect',
        data: {},
      });
    this.studyId = studyId;

    // Error if login failed or if there was a SQL issue that was not a duplicate record
    // (23505 is the code for unique constraint violation in PostgreSQL)
    if (error || (schemaError && schemaError.code !== '23505')) {
      console.error('Error initializing study DB:', error || schemaError);
      // throw new Error('Failed to initialize study DB');
    }
  }

  async connect() {
    return new Promise<void>((resolve, reject) => {
      // Check if the Supabase client is connected
      if (this.supabase) {
        this.connected = true;
        resolve();
      } else {
        reject(new Error('Failed to connect to Supabase'));
      }
    });
  }

  async getModes(studyId: string) {
    // get the modes from the study collection
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'metadata');
    if (error) {
      throw new Error('Failed to get modes');
    }
    if (data.length > 0) {
      // get the metadata field from the data object
      const metadata = data[0].data;
      if (metadata) {
        return metadata;
      }
    }

    const defaultModes = {
      dataCollectionEnabled: true,
      studyNavigatorEnabled: true,
      analyticsInterfacePubliclyAccessible: true,
    };
    await this.supabase
      .from('revisit')
      .upsert({
        studyId: `${this.collectionPrefix}${studyId}`,
        docId: 'metadata',
        data: defaultModes,
      })
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'metadata');
    return defaultModes;
  }

  async setMode(studyId: string, mode: REVISIT_MODE, value: boolean) {
    const modes = await this.getModes(studyId);
    // Update the mode
    modes[mode] = value;
    // Set the updated modes in the study collection
    await this.supabase
      .from('revisit')
      .upsert({
        studyId: `${this.collectionPrefix}${studyId}`,
        docId: 'metadata',
        data: modes,
      })
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'metadata');
  }

  protected async _setModesDocument(studyId: string, modesDocument: Record<string, unknown>): Promise<void> {
    await this.supabase
      .from('revisit')
      .upsert({
        studyId: `${this.collectionPrefix}${studyId}`,
        docId: 'metadata',
        data: modesDocument,
      })
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'metadata');
  }

  protected async _getAudioUrl(task: string, participantId?: string) {
    await this.verifyStudyDatabase();
    // If participantId is not provided, use the current participant id
    const id = participantId || this.currentParticipantId;
    if (!id) {
      throw new Error('Participant not initialized');
    }

    // Get the audio from the storage
    const audio = await this._getFromStorage(`/audio/${id}`, task);
    return audio ? URL.createObjectURL(audio) : null;
  }

  protected async _getScreenRecordingUrl(task: string, participantId?: string) {
    await this.verifyStudyDatabase();
    // If participantId is not provided, use the current participant id
    const id = participantId || this.currentParticipantId;
    if (!id) {
      throw new Error('Participant not initialized');
    }

    // Get the screen recording from the storage
    const screenRecording = await this._getFromStorage(`/screenRecording/${id}`, task);
    return screenRecording ? URL.createObjectURL(screenRecording) : null;
  }

  protected async _testingReset(studyId: string) {
    // Delete all rows with studyId matching the studyId
    const { error } = await this.supabase
      .from('revisit')
      .delete()
      .eq('studyId', `${this.collectionPrefix}${studyId}`);
    if (error) {
      throw new Error('Failed to reset study database');
    }

    // Delete the storage bucket folder for the study
    const { data: filePaths, error: filePathsError } = await this.supabase
      .schema('storage')
      .from('objects')
      .select('name')
      .eq('bucket_id', 'revisit')
      .like('name', `${this.collectionPrefix}${studyId}%`); // remove or keep the % based on your needs

    if (filePathsError) {
      throw new Error('Failed to retrieve file paths for reset');
    }

    if (filePaths && filePaths.length > 0) {
      const { error: deleteError } = await this.supabase.storage
        .from('revisit')
        .remove(filePaths.map((file) => file.name));

      if (deleteError) {
        throw new Error('Failed to delete files from storage during reset');
      }
    }

    await super.__testingReset();
  }

  async getSnapshots(studyId: string) {
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'snapshots')
      .single();
    if (error) {
      return {};
    }
    return data?.data as SnapshotDocContent || {};
  }

  protected async _directoryExists(path: string): Promise<boolean> {
    const { data, error } = await this.supabase.storage
      .from('revisit')
      .list(path, { limit: 1 });
    if (error) {
      console.error('Error checking directory existence:', error);
      return false;
    }
    // If data is empty, the directory does not exist
    return data.length > 0;
  }

  protected async _copyDirectory(source: string, target: string) {
    const { data: keys, error } = await this.supabase.storage
      .from('revisit')
      .list(source);
    if (error) {
      console.error('Error listing directory contents:', error);
      throw new Error('Failed to copy directory');
    }
    const copyPromises = keys.map(async (key) => {
      const { data: fileData, error: fileError } = await this.supabase.storage
        .from('revisit')
        .download(`${source}/${key.name}`);
      if (fileError) {
        // We probably have a nested directory, so we can skip this file
        return;
      }
      const { error: uploadError } = await this.supabase.storage
        .from('revisit')
        .upload(`${target}/${key.name}`, fileData, { upsert: true });
      if (uploadError) {
        console.error(`Error uploading file to ${target}/${key.name}:`, uploadError);
      }
    });
    await Promise.all(copyPromises);
  }

  protected async _deleteDirectory(path: string) {
    const { data: keys, error } = await this.supabase.storage
      .from('revisit')
      .list(path);
    if (error) {
      console.error('Error listing directory contents:', error);
      throw new Error('Failed to delete directory');
    }
    if (keys.length === 0) {
      // Skip deletion if the directory is empty
      return;
    }
    const toDelete = keys.map((key) => `${path}/${key.name}`);
    const { error: deleteError } = await this.supabase.storage
      .from('revisit')
      .remove(toDelete);
    if (deleteError) {
      throw new Error('Failed to delete directory');
    }
  }

  protected async _copyRealtimeData(source: string, target: string) {
    const { data: rows, error } = await this.supabase
      .from('revisit')
      .select('createdAt, studyId, docId, data')
      .eq('studyId', source)
      .like('docId', 'sequenceAssignment_%');
    if (error) {
      throw new Error('Failed to copy realtime data');
    }

    // Batch upload the rows to the target study
    const toUpload = rows.map((row) => ({
      ...row,
      studyId: target,
    }));
    const { error: uploadError } = await this.supabase
      .from('revisit')
      .upsert(toUpload);
    if (uploadError) {
      console.error('Error uploading realtime data for:', uploadError);
    }
  }

  protected async _deleteRealtimeData(target: string) {
    const { error } = await this.supabase
      .from('revisit')
      .delete()
      .eq('studyId', target)
      .like('docId', 'sequenceAssignment_%');
    if (error) {
      throw new Error('Failed to delete realtime data');
    }
  }

  protected async _addDirectoryNameToSnapshots(directoryName: string, studyId: string) {
    const snapshots = await this.getSnapshots(studyId);
    if (!snapshots[directoryName]) {
      snapshots[directoryName] = { name: directoryName };
      await this.supabase
        .from('revisit')
        .upsert({
          studyId: `${this.collectionPrefix}${studyId}`,
          docId: 'snapshots',
          data: snapshots,
        });
    }
  }

  protected async _removeDirectoryNameFromSnapshots(directoryName: string, studyId: string) {
    const snapshots = await this.getSnapshots(studyId);
    if (snapshots[directoryName]) {
      delete snapshots[directoryName];
      await this.supabase
        .from('revisit')
        .upsert({
          studyId: `${this.collectionPrefix}${studyId}`,
          docId: 'snapshots',
          data: snapshots,
        });
    }
  }

  protected async _changeDirectoryNameInSnapshots(oldName: string, newName: string, studyId: string) {
    const snapshots = await this.getSnapshots(studyId);
    if (snapshots[oldName]) {
      snapshots[oldName] = { name: newName };
      await this.supabase
        .from('revisit')
        .upsert({
          studyId: `${this.collectionPrefix}${studyId}`,
          docId: 'snapshots',
          data: snapshots,
        });
    }
  }

  // Gets data from the user-management collection based on the inputted string
  async getUserManagementData(key: 'authentication'): Promise<{ isEnabled: boolean } | undefined>;

  async getUserManagementData(key: 'adminUsers'): Promise<{ adminUsersList: StoredUser[] } | undefined>;

  async getUserManagementData(
    key: 'authentication' | 'adminUsers',
  ): Promise<{ isEnabled: boolean } | { adminUsersList: StoredUser[] } | undefined> {
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', '')
      .eq('docId', 'user-management')
      .single();

    if (error) {
      console.error(`Error fetching user management data for key ${key}:`, error);
      return undefined;
    }

    this.userManagementData = data?.data || {};

    if (key in this.userManagementData) {
      // Type narrowing to ensure correct return type
      if (key === 'authentication') {
        const value = this.userManagementData[key];
        if (value && typeof value === 'object' && 'isEnabled' in value) {
          return value as { isEnabled: boolean };
        }
      } else if (key === 'adminUsers') {
        const value = this.userManagementData[key];
        if (value && typeof value === 'object' && 'adminUsersList' in value) {
          return value as { adminUsersList: StoredUser[] };
        }
      }
    }
    return undefined;
  }

  protected async _updateAdminUsersList(adminUsers: { adminUsersList: StoredUser[]; }) {
    await this.getUserManagementData('adminUsers');
    const updatedData = structuredClone(this.userManagementData);
    updatedData.adminUsers = { adminUsersList: adminUsers.adminUsersList };

    const { error } = await this.supabase
      .from('revisit')
      .upsert({
        studyId: '',
        docId: 'user-management',
        data: updatedData,
      });

    if (error) {
      console.error('Error updating admin users list:', error);
      throw new Error('Failed to update admin users list');
    }
  }

  async changeAuth(bool: boolean) {
    await this.getUserManagementData('authentication');
    const updatedData = structuredClone(this.userManagementData);
    updatedData.authentication = { isEnabled: bool };

    const { error } = await this.supabase
      .from('revisit')
      .upsert({
        studyId: '',
        docId: 'user-management',
        data: updatedData,
      });

    if (error) {
      console.error('Error changing authentication state:', error);
      throw new Error('Failed to change authentication state');
    }
  }

  async addAdminUser(user: StoredUser) {
    await this.getUserManagementData('adminUsers');
    const updatedData = structuredClone(this.userManagementData);
    if (!updatedData.adminUsers) {
      updatedData.adminUsers = { adminUsersList: [] };
    }
    updatedData.adminUsers.adminUsersList.push(user);

    await this._updateAdminUsersList(updatedData.adminUsers);
  }

  async removeAdminUser(email: string): Promise<void> {
    await this.getUserManagementData('adminUsers');
    const updatedData = structuredClone(this.userManagementData);
    if (updatedData.adminUsers) {
      updatedData.adminUsers.adminUsersList = updatedData.adminUsers.adminUsersList.filter(
        (user) => user.email !== email,
      );
      await this._updateAdminUsersList(updatedData.adminUsers);
    } else {
      console.warn('No admin users found to remove');
    }
  }

  async login() {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.href },
    });

    if (error) throw error;

    // Redirect-based flow: user not available immediately
    const { data: sessionData } = await this.supabase.auth.getSession();
    const user = sessionData.session?.user;

    return user ? { email: user.email ?? null, uid: user.id } : null;
  }

  async getSession() {
    return this.supabase.auth.getSession();
  }

  unsubscribe(callback: (cloudUser: StoredUser | null) => Promise<void>) {
    let lastUid: string | null = null;
    let count = 0;

    const { data: listener } = this.supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user
        ? ({
          email: session.user.email,
          uid: session.user.id,
        } as StoredUser)
        : null;

      const uid = user?.uid ?? null;
      // If first time and no user, just call back with null
      if (user === null && count === 0) {
        count += 1;
        callback(null);
        return;
      }

      // Only invoke callback if the user actually changed
      if (uid === lastUid) return;
      lastUid = uid;

      await callback(user);
    });

    return () => listener.subscription.unsubscribe();
  }

  async logout() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }
}
