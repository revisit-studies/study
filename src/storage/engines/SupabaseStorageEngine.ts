import { createClient } from '@supabase/supabase-js';
import {
  REVISIT_MODE, SequenceAssignment, StorageEngine, StorageObject, StorageObjectType,
} from './types';

export class SupabaseStorageEngine extends StorageEngine {
  private supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

  constructor() {
    super('supabase');
  }

  protected async _getFromStorage<T extends StorageObjectType>(prefix: string, type: T, studyId?: string) {
    const { data, error } = await this.supabase.storage
      .from('revisit')
      .download(`${studyId || this.studyId}/${prefix}_${type}`);

    if (error) {
      return {} as StorageObject<T>;
    }

    const text = await data.text();
    return JSON.parse(text) as StorageObject<T>;
  }

  protected async _pushToStorage<T extends StorageObjectType>(prefix: string, type: T, objectToUpload: StorageObject<T>) {
    const blob = new Blob([JSON.stringify(objectToUpload)], {
      type: 'application/json',
    });
    const { error } = await this.supabase.storage
      .from('revisit')
      .upload(`${this.studyId}/${prefix}_${type}`, blob, {
        upsert: true,
      });

    if (error) {
      throw new Error('Failed to upload to Supabase');
    }
  }

  protected async _deleteFromStorage<T extends StorageObjectType>(prefix: string, type: T) {
    const { error } = await this.supabase.storage
      .from('revisit')
      .remove([`${this.studyId}/${prefix}_${type}`]);

    if (error) {
      throw new Error('Failed to delete from Supabase');
    }
  }

  protected async _cacheStorageObject<T extends StorageObjectType>(prefix: string, type: T) {
    // Download the existing object
    const { data, error: downloadError } = await this.supabase.storage
      .from('revisit')
      .download(`${this.studyId}/${prefix}_${type}`);

    if (downloadError || !data) {
      throw new Error('Failed to download object for cache update');
    }

    // Re-upload the object with the desired cache control header
    const { error: uploadError } = await this.supabase.storage
      .from('revisit')
      .upload(
        `${this.studyId}/${prefix}_${type}`,
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
    const { data, error } = await this.supabase
      .from('revisit')
      .select('*')
      .eq('studyId', this.studyId);
    if (error || data.length === 0) {
      throw new Error('Study database not initialized or does not exist');
    }
  }

  protected async _getCurrentConfigHash() {
    await this.verifyStudyDatabase();
    const { data } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', this.studyId)
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
        studyId: this.studyId,
        docId: 'currentConfigHash',
        data: { configHash },
      })
      .eq('studyId', this.studyId)
      .eq('docId', 'currentConfigHash');
  }

  protected async _getAllSequenceAssignments(studyId: string) {
    await this.verifyStudyDatabase();
    // get all sequence assignments from the study collection
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', studyId)
      .like('docId', '%sequenceAssignment%');
    if (error) {
      throw new Error('Failed to get sequence assignments');
    }
    return data.map((item) => item.data as SequenceAssignment);
  }

  protected async _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment) {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }
    // Create a sequence assignment for the participant in the study collection
    await this.supabase
      .from('revisit')
      .upsert({
        studyId: this.studyId,
        docId: `sequenceAssignment_${participantId}`,
        data: sequenceAssignment,
      })
      .eq('studyId', this.studyId)
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
      .eq('studyId', this.studyId)
      .eq('docId', `sequenceAssignment_${this.currentParticipantId}`)
      .single();

    if (error || !data) {
      throw new Error('Failed to retrieve sequence assignment for current participant');
    }

    // Update the sequence assignment for the current participant to mark it as completed
    const sequenceAssignmentPath = `sequenceAssignment_${this.currentParticipantId}`;
    await this.supabase
      .from('revisit')
      .update({ ...data.data, completed: new Date().getTime() })
      .eq('studyId', this.studyId)
      .eq('docId', sequenceAssignmentPath);
  }

  protected async _rejectParticipantRealtime(participantId: string) {
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
      .eq('studyId', this.studyId)
      .eq('docId', sequenceAssignmentPath)
      .single();

    if (error || !data) {
      throw new Error('Failed to retrieve sequence assignment for current participant');
    }

    // Update the sequence assignment for the participant to mark it as rejected
    await this.supabase
      .from('revisit')
      .update({ ...data.data, rejected: true })
      .eq('studyId', this.studyId)
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
      .update({ ...sequenceAssignment, claimed: true })
      .eq('studyId', this.studyId)
      .eq('docId', sequenceAssignmentPath);
  }

  async initializeStudyDb(studyId: string) {
    const { error } = await this.supabase.auth.signInAnonymously(); // TODO: Fix logins

    // Write a row into the revisit table for the study
    const { error: schemaError } = await this.supabase
      .from('revisit')
      .upsert({
        studyId,
        docId: 'connect',
        data: {},
      });
    this.studyId = studyId;

    // Error if login failed or if there was a SQL issue that was not a duplicate record
    // (23505 is the code for unique constraint violation in PostgreSQL)
    if (error || (schemaError && schemaError.code !== '23505')) {
      // console.error('Error initializing study DB:', error || schemaError); TODO: Fix logins
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
      .eq('studyId', studyId)
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
        studyId,
        docId: 'metadata',
        data: defaultModes,
      })
      .eq('studyId', studyId)
      .eq('docId', 'metadata');
    return defaultModes;
  }

  async setMode(studyId: string, mode: REVISIT_MODE, value: boolean) {
    await this.verifyStudyDatabase();
    const modes = await this.getModes(studyId);
    // Update the mode
    modes[mode] = value;
    // Set the updated modes in the study collection
    await this.supabase
      .from('revisit')
      .upsert({
        studyId,
        docId: 'metadata',
        data: modes,
      })
      .eq('studyId', studyId)
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
    if (audio) {
      return URL.createObjectURL(new Blob([JSON.stringify(audio)], { type: 'application/json' }));
    }
    return null;
  }
}
