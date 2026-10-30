import { AuthError, createClient } from '@supabase/supabase-js';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import {
  isParticipantData, rebuildSequenceAllocator, retrySequenceAllocation, SEQUENCE_ALLOCATION_ATTEMPTS, waitForAllocationRetry,
} from './utils/storageEngineHelpers';
import {
  StageAllocation, REVISIT_MODE, RuntimeStudySettings, SequenceAssignment, SnapshotDocContent, StorageObject, StorageObjectType, StoredUser, CloudStorageEngine, UserWrapped, cleanupModes, consumesCapacity, applyStageUpdates, StageData, SequenceAssignmentAllocation, SequenceAllocator,
} from './types';
import { SnapshotParticipantCounts } from './utils/snapshotParticipantCounts';

// Signals that a conditional timeout write matched no row, so the stage counts
// must not change.
class TimeoutNotAppliedError extends Error {}

export class SupabaseStorageEngine extends CloudStorageEngine {
  private supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

  protected participantStore = localforage.createInstance({
    name: 'revisit-supabase',
  });

  constructor(testing: boolean = false) {
    super('supabase', testing);
  }

  protected async _getFromStorage<T extends StorageObjectType>(prefix: string, type: T, studyId?: string, strict = false) {
    const { data, error } = await this.supabase.storage
      .from('revisit')
      .download(`${this.collectionPrefix}${studyId || this.studyId}/${prefix}_${type}`);

    if (error) {
      const downloadError = error as { status?: number; statusCode?: string };
      if ((strict || type === 'sequenceArray' || type === 'participantData') && downloadError.status !== 404 && String(downloadError.statusCode) !== '404') throw error;
      return {} as StorageObject<T>;
    }

    const dataToParse = this.testing ? new Blob([data as unknown as string], { type: 'application/json' }) : data;
    try {
      const text = await dataToParse.text();
      const parsed = JSON.parse(text) as StorageObject<T>;
      if (type === 'participantData' && !isParticipantData(parsed)) throw new Error('Invalid participant data');
      return parsed;
    } catch (parseError) {
      if (strict || type === 'sequenceArray' || type === 'participantData') throw parseError;
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
    const { data, error } = await this.supabase
      .from('revisit')
      .select('docId')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', 'connect')
      .maybeSingle();
    if (error || !data || !this.studyId) {
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

  protected override async activateConfig(configHash: string, keys: string[]) {
    const stage = await this.validateStageConditions(this.studyId!, keys);
    await this._runWithLock('study-settings', async () => {
      const modes: Record<REVISIT_MODE, boolean> & { stage?: StageData } = await this.getModes(this.studyId!);
      const studyId = `${this.collectionPrefix}${this.studyId}`;
      // A single upsert commits both rows in one database transaction.
      const { error } = await this.supabase.from('revisit').upsert([
        { studyId, docId: 'metadata', data: { ...modes, stage: applyStageUpdates(modes.stage!, stage.stageName, { conditionKeys: keys }) } },
        { studyId, docId: 'currentConfigHash', data: { configHash } },
      ]);
      if (error) throw new Error('Failed to activate study config');
    });
  }

  public async getAllSequenceAssignments(studyId: string) {
    const assignments: SequenceAssignment[] = [];
    let afterDocId: string | undefined;
    // Use the last returned ID rather than a fixed offset or page length: the
    // backend may impose a smaller response limit than the requested page size.
    for (;;) {
      let request = this.supabase.from('revisit').select('docId, data, createdAt')
        .eq('studyId', `${this.collectionPrefix}${studyId}`).like('docId', 'sequenceAssignment_%')
        .order('docId', { ascending: true })
        .limit(1000);
      if (afterDocId !== undefined) request = request.gt('docId', afterDocId);
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await request;
      if (error) throw new Error('Failed to get sequence assignments');
      if (!data.length) return assignments.sort((a, b) => a.timestamp - b.timestamp);
      assignments.push(...data.map((item) => ({
        ...item.data,
        timestamp: item.data.withServerTimestamp ? new Date(item.createdAt).getTime() : item.data.timestamp,
        createdTime: new Date(item.createdAt).getTime(),
      } as SequenceAssignment)));
      afterDocId = data[data.length - 1].docId;
    }
  }

  public async getSequenceAssignment(studyId: string, participantId: string) {
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data, createdAt')
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', `sequenceAssignment_${participantId}`)
      .limit(1);
    if (error) throw new Error('Failed to get sequence assignment');
    if (!data?.length) return null;
    const assignment = data[0];
    return {
      ...assignment.data,
      timestamp: assignment.data.withServerTimestamp ? new Date(assignment.createdAt).getTime() : assignment.data.timestamp,
      createdTime: new Date(assignment.createdAt).getTime(),
    } as SequenceAssignment;
  }

  protected async _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment, withServerTimestamp = false) {
    await this.verifyStudyDatabase();
    const previous = await this._getSequenceAssignment(participantId);
    await this.changeStageCounts(previous, sequenceAssignment, async () => {
      const { error } = await this.supabase.from('revisit').upsert({ studyId: `${this.collectionPrefix}${this.studyId}`, docId: `sequenceAssignment_${participantId}`, data: { ...sequenceAssignment, withServerTimestamp } });
      if (error) throw new Error(`Failed to create sequence assignment for participant ${participantId}`);
    });
  }

  private async updateSequenceAssignmentRow(participantId: string, data: Record<string, unknown>, operation: string) {
    const previous = await this._getSequenceAssignment(participantId);
    await this.changeStageCounts(previous, data as SequenceAssignment, async () => {
      const { data: rows, error } = await this.supabase.from('revisit').update({ data }).eq('studyId', `${this.collectionPrefix}${this.studyId}`).eq('docId', `sequenceAssignment_${participantId}`)
        .select('docId');
      if (error || rows?.length !== 1) throw new Error(`Failed to ${operation} sequence assignment for participant ${participantId}`);
    });
  }

  protected async _updateSequenceAssignmentFields(participantId: string, updatedFields: Partial<SequenceAssignment>) {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `sequenceAssignment_${participantId}`;
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', sequenceAssignmentPath)
      .single();

    if (error || !data) {
      throw new Error('Failed to retrieve sequence assignment for update');
    }

    const updatedData = { ...data.data, ...updatedFields };
    if (Object.hasOwn(updatedFields, 'conditions') && updatedFields.conditions === undefined) {
      delete updatedData.conditions;
    }

    await this.updateSequenceAssignmentRow(participantId, updatedData, 'update');
  }

  protected async _getSequenceAssignment(participantId: string) {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const { data, error } = await this.supabase
      .from('revisit')
      .select('data, createdAt')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', `sequenceAssignment_${participantId}`)
      .maybeSingle();

    if (error) {
      throw new Error('Failed to retrieve sequence assignment');
    }
    if (!data) {
      return null;
    }

    return {
      ...data.data,
      timestamp: data.data.withServerTimestamp ? new Date(data.createdAt).getTime() : data.data.timestamp,
      createdTime: new Date(data.createdAt).getTime(),
    } as SequenceAssignment;
  }

  protected async _runWithLock<T>(lockKey: string, operation: () => Promise<T>) {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const studyId = `${this.collectionPrefix}${this.studyId}`;
    const lockDocumentId = `lock_${lockKey}`;
    const token = uuidv4();
    const expiresInMs = 60_000;
    const acquireLock = async (attempt: number): Promise<void> => {
      const now = Date.now();
      const { data: existingLockRow, error: readError } = await this.supabase
        .from('revisit')
        .select('data')
        .eq('studyId', studyId)
        .eq('docId', lockDocumentId)
        .maybeSingle();

      if (readError) {
        throw new Error('Failed to read study update lock');
      }

      const existingLock = existingLockRow?.data as {
        token?: string;
        expiresAt?: number;
      } | undefined;
      if (!existingLockRow) {
        const { error: createError } = await this.supabase
          .from('revisit')
          .insert({
            studyId,
            docId: lockDocumentId,
            data: { token, expiresAt: now + expiresInMs },
          });
        if (!createError) {
          return;
        }
        if (createError.code !== '23505') {
          throw new Error('Failed to create study update lock');
        }
      } else if (!existingLock?.expiresAt || existingLock.expiresAt <= now) {
        const { data: updatedLockRows, error: updateError } = await this.supabase
          .from('revisit')
          .update({ data: { token, expiresAt: now + expiresInMs } })
          .eq('studyId', studyId)
          .eq('docId', lockDocumentId)
          .eq('data->>token', existingLock?.token ?? '')
          .select('docId');
        if (updateError) {
          throw new Error('Failed to acquire expired study update lock');
        }
        if ((updatedLockRows?.length ?? 0) === 1) {
          return;
        }
      }

      if (attempt >= 299) {
        throw new Error('Timed out while waiting for a study update to finish');
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });
      await acquireLock(attempt + 1);
    };

    await acquireLock(0);

    let lockRefreshError: unknown;
    const refreshLock = async () => {
      const { data, error } = await this.supabase
        .from('revisit')
        .update({ data: { token, expiresAt: Date.now() + expiresInMs } })
        .eq('studyId', studyId)
        .eq('docId', lockDocumentId)
        .eq('data->>token', token)
        .select('docId');
      if (error || (data?.length ?? 0) !== 1) {
        throw error || new Error('Study update lock was lost');
      }
    };
    const refreshTimer = setInterval(() => {
      refreshLock().catch((error: unknown) => {
        lockRefreshError ??= error;
      });
    }, expiresInMs / 3);

    try {
      const result = await operation();
      if (lockRefreshError) {
        throw lockRefreshError;
      }
      return result;
    } finally {
      clearInterval(refreshTimer);
      const { error } = await this.supabase
        .from('revisit')
        .delete()
        .eq('studyId', studyId)
        .eq('docId', lockDocumentId)
        .eq('data->>token', token);
      if (error) {
        console.warn('Failed to release study update lock:', error);
      }
    }
  }

  protected async _completeCurrentParticipantRealtime() {
    await this.verifyStudyDatabase();
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const participantId = this.currentParticipantId;
    // Get the sequence assignment for the current participant
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', `sequenceAssignment_${participantId}`)
      .single();

    if (error || !data) {
      throw new Error('Failed to retrieve sequence assignment for current participant');
    }

    // Update the sequence assignment for the current participant to mark it as completed
    await this.updateSequenceAssignmentRow(
      participantId,
      { ...data.data, completed: new Date().getTime() },
      'complete',
    );
  }

  protected async _rejectParticipantRealtime(participantId: string, onlyIncomplete = false) {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `sequenceAssignment_${participantId}`;
    // Get the sequence assignment for the participant
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data, createdAt')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', sequenceAssignmentPath)
      .single();

    if (error || !data) {
      throw new Error('Failed to retrieve sequence assignment for current participant');
    }

    if (onlyIncomplete && (data.data.completed !== null || data.data.autoTimedOutAt !== undefined)) return false;
    if (data.data.rejected) return true;
    const reusableSequenceIndex = data.data.claimedParticipantId
      ? (await this.reserveSequenceAllocator(await this.getOrCreateSequenceAllocator(), undefined, false)).sequenceIndex : undefined;
    // Update the sequence assignment for the participant to mark it as rejected
    await this.updateSequenceAssignmentRow(
      participantId,
      {
        ...data.data, rejected: true, timestamp: new Date().getTime(), ...(reusableSequenceIndex === undefined ? {} : { reusableSequenceIndex }),
      },
      'reject',
    );

    const claimedParticipantId = data.data.claimedParticipantId as string | undefined;
    if (claimedParticipantId) {
      const claimedSequenceAssignmentPath = `sequenceAssignment_${claimedParticipantId}`;
      await this._runWithLock(`participant-${claimedParticipantId}`, async () => {
        const { data: claimedData, error: claimedError } = await this.supabase
          .from('revisit')
          .select('data')
          .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
          .eq('docId', claimedSequenceAssignmentPath)
          .single();

        if (claimedError || !claimedData) {
          throw new Error('Failed to retrieve claimed sequence assignment for rejection');
        }

        // Preserve a timed-out source as timed out when its replacement is rejected.
        await this.updateSequenceAssignmentRow(
          claimedParticipantId,
          claimedData.data.autoTimedOutAt === undefined
            ? { ...claimedData.data, claimed: false, rejected: true }
            : { ...claimedData.data, claimed: false },
          'release claimed',
        );
      });
      return true;
    }

    // Fallback for legacy reused assignments that predate claimedParticipantId.
    // Only a replacement copies its source's timestamp; a fresh assignment uses
    // the server timestamp, so it never claimed anything and must not release
    // another participant who happens to share its stored timestamp.
    if (data.data.withServerTimestamp) {
      return true;
    }
    const { data: matchingRows, error: claimedError } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .like('docId', 'sequenceAssignment_%')
      .eq('data->timestamp', data.data.timestamp)
      .neq('docId', sequenceAssignmentPath);

    if (claimedError || !matchingRows) {
      return true;
    }
    // The source of a legacy replacement is claimed, no longer holds a slot,
    // and is not itself a current-format replacement.
    const legacySources = (matchingRows as { data: SequenceAssignment }[]).filter(({ data: candidate }) => (
      candidate.claimed
      && candidate.claimedParticipantId === undefined
      && (candidate.rejected || candidate.autoTimedOutAt !== undefined)
    ));
    if (legacySources.length !== 1) {
      return true;
    }
    const legacyClaimedParticipantId = legacySources[0].data.participantId;
    await this._runWithLock(`participant-${legacyClaimedParticipantId}`, async () => {
      const { data: latestClaimedData, error: latestClaimedError } = await this.supabase
        .from('revisit')
        .select('data')
        .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
        .eq('docId', `sequenceAssignment_${legacyClaimedParticipantId}`)
        .single();
      if (latestClaimedError || !latestClaimedData) {
        throw new Error('Failed to retrieve claimed sequence assignment for rejection');
      }
      if (!latestClaimedData.data.claimed) {
        return;
      }
      await this.updateSequenceAssignmentRow(
        legacyClaimedParticipantId,
        latestClaimedData.data.autoTimedOutAt === undefined
          ? { ...latestClaimedData.data, claimed: false, rejected: true }
          : { ...latestClaimedData.data, claimed: false },
        'release claimed',
      );
    });
    return true;
  }

  protected async _undoRejectParticipantRealtime(participantId: string) {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `sequenceAssignment_${participantId}`;
    // Get the sequence assignment for the participant
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data, createdAt')
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .eq('docId', sequenceAssignmentPath)
      .single();

    if (error || !data) {
      throw new Error('Failed to retrieve sequence assignment for current participant');
    }

    if (!data.data.rejected) return;
    const claimedParticipantId = data.data.claimedParticipantId as string | undefined;
    let restoredTimestamp = data.data.withServerTimestamp
      ? new Date(data.createdAt).getTime()
      : data.data.timestamp as number | undefined;

    if (claimedParticipantId) {
      const claimedSequenceAssignmentPath = `sequenceAssignment_${claimedParticipantId}`;
      await this._runWithLock(`participant-${claimedParticipantId}`, async () => {
        const { data: claimedData, error: claimedError } = await this.supabase
          .from('revisit')
          .select('data, createdAt')
          .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
          .eq('docId', claimedSequenceAssignmentPath)
          .single();

        if (claimedError || !claimedData) {
          throw new Error('Failed to retrieve claimed sequence assignment for unrejection');
        }

        if (claimedData.data.claimed) throw new Error('Cannot restore a participant whose original slot has been reassigned');
        restoredTimestamp = claimedData.data.withServerTimestamp
          ? new Date(claimedData.createdAt).getTime()
          : claimedData.data.timestamp as number | undefined;

        await this.updateSequenceAssignmentRow(
          claimedParticipantId,
          claimedData.data.autoTimedOutAt === undefined
            ? { ...claimedData.data, claimed: true, rejected: true }
            : { ...claimedData.data, claimed: true },
          'restore claimed',
        );
      });
    }

    const updated = { ...data.data, rejected: false, timestamp: restoredTimestamp };
    delete updated.reusableSequenceIndex;
    // Update the sequence assignment for the participant to mark it as un-rejected
    await this.updateSequenceAssignmentRow(
      participantId,
      updated,
      'restore',
    );
    if (data.data.reusableSequenceIndex !== undefined) await this.returnSequenceIndex(data.data.reusableSequenceIndex as number);
  }

  protected async _claimSequenceAssignment(participantId: string) {
    await this.verifyStudyDatabase();
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentPath = `sequenceAssignment_${participantId}`;
    await this._runWithLock(`participant-${participantId}`, async () => {
      // Re-read the source row inside the lock. This whole-record JSON update
      // would otherwise overwrite a completion, rejection, or timeout that
      // landed after the caller read the assignment.
      const { data: existingRow, error: readError } = await this.supabase
        .from('revisit')
        .select('data')
        .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
        .eq('docId', sequenceAssignmentPath)
        .single();
      if (readError || !existingRow) {
        throw new Error(`Sequence assignment for participant ${participantId} not found`);
      }

      await this.updateSequenceAssignmentRow(
        participantId,
        { ...existingRow.data, claimed: true },
        'claim',
      );
    });
  }

  protected async _getServerTimeMs(): Promise<number> {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }
    // `createdAt` is filled in by the database, so re-creating a throwaway row
    // reads back the server's clock. Callers hold the participant-assignment
    // lock, so only one session touches this row at a time.
    const studyId = `${this.collectionPrefix}${this.studyId}`;
    await this.supabase
      .from('revisit')
      .delete()
      .eq('studyId', studyId)
      .eq('docId', 'serverTime');
    const { data, error } = await this.supabase
      .from('revisit')
      .insert({ studyId, docId: 'serverTime', data: {} })
      .select('createdAt')
      .single();
    if (error || !data?.createdAt) {
      throw new Error('Failed to read the server clock');
    }
    return new Date(data.createdAt).getTime();
  }

  protected async _markSequenceAssignmentTimedOut(participantId: string, timedOutAt: number, deadline?: number): Promise<boolean> {
    return await this._runWithLock(`participant-${participantId}`, async () => {
      await this.verifyStudyDatabase();
      if (!this.studyId) {
        throw new Error('Study ID is not set');
      }
      const sequenceAssignmentPath = `sequenceAssignment_${participantId}`;
      const { data, error } = await this.supabase
        .from('revisit')
        .select('data, createdAt')
        .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
        .eq('docId', sequenceAssignmentPath)
        .single();
      if (error || !data) {
        throw new Error(`Failed to retrieve sequence assignment for participant ${participantId}`);
      }

      const assignment = data.data as SequenceAssignment;
      const createdTime = new Date(data.createdAt).getTime();
      if (assignment.completed !== null || assignment.rejected || assignment.autoTimedOutAt !== undefined
        || (deadline !== undefined && (!Number.isFinite(createdTime) || createdTime > deadline))) {
        return false;
      }
      const timedOutAssignment = { ...assignment, autoTimedOutAt: timedOutAt };
      let updated = false;
      // The timeout releases the slot, so the stage counts move with the write.
      // They are only adjusted when the conditional write lands.
      await this.changeStageCounts(await this._getSequenceAssignment(participantId), timedOutAssignment, async () => {
        const { data: updatedRows, error: updateError } = await this.supabase
          .from('revisit')
          .update({ data: timedOutAssignment })
          .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
          .eq('docId', sequenceAssignmentPath)
          .eq('data->>rejected', 'false')
          .is('data->>completed', null)
          .is('data->>autoTimedOutAt', null)
          .select('docId');
        if (updateError) {
          throw new Error(`Failed to mark participant ${participantId} as timed out`);
        }
        updated = (updatedRows?.length ?? 0) === 1;
        if (!updated) {
          throw new TimeoutNotAppliedError();
        }
      }, true).catch((changeError) => {
        if (!(changeError instanceof TimeoutNotAppliedError)) throw changeError;
      });
      if (updated) {
        return true;
      }

      // A zero-row conditional update is only safe when a fresh read confirms
      // that a concurrent completion, rejection, or timeout won the race.
      const latestAssignment = await this._getSequenceAssignment(participantId);
      if (
        latestAssignment
        && (latestAssignment.completed !== null
          || latestAssignment.rejected
          || latestAssignment.autoTimedOutAt !== undefined)
      ) {
        return false;
      }
      throw new Error(`Could not confirm timeout status for participant ${participantId}`);
    });
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
    const { error } = await this.supabase
      .from('revisit')
      .select('studyId')
      .limit(1);

    this.connected = !error;
    if (error) {
      throw new Error('Failed to connect to Supabase');
    }
  }

  async getStorageDisconnected(studyId: string) {
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'storage');
    if (error) throw new Error('Failed to read storage mode', { cause: error });
    if (!data.length) return false;
    const disconnected = data[0]?.data?.disconnected;
    if (typeof disconnected !== 'boolean') throw new Error('Invalid storage mode');
    return disconnected;
  }

  protected async _setStorageDisconnected(studyId: string, disconnected: boolean) {
    const { error } = await this.supabase.from('revisit').upsert({
      studyId: `${this.collectionPrefix}${studyId}`,
      docId: 'storage',
      data: { disconnected },
    });
    if (error) throw new Error('Failed to update storage mode', { cause: error });
  }

  protected async getAuthenticatedUser() {
    const { data, error } = await this.supabase.auth.getUser();
    if (error) throw new Error('Failed to verify administrator', { cause: error });
    return data.user ? { email: data.user.email ?? null, uid: data.user.id } : null;
  }

  async getAccessModes(studyId: string) {
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'metadata');
    if (error) throw new Error('Failed to get modes');
    const modes = data?.[0]?.data;
    if (!modes || typeof modes !== 'object' || Array.isArray(modes)) return null;
    const cleanedModes = cleanupModes(modes as Record<string, boolean>);
    return { ...cleanedModes, dataSharingEnabled: cleanedModes.dataSharingEnabled === true };
  }

  async getModes(studyId: string): Promise<RuntimeStudySettings> {
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'metadata');
    if (error) {
      throw new Error('Failed to get modes');
    }
    const metadata = data[0]?.data;
    if (metadata) {
      // Normalize legacy fields in memory. An ordinary read must not rewrite
      // a stale copy over a setting saved by another session.
      return cleanupModes(metadata as RuntimeStudySettings) as RuntimeStudySettings;
    }

    const defaultModes = {
      dataCollectionEnabled: true,
      developmentModeEnabled: true,
      dataSharingEnabled: false,
    };
    const { error: defaultModesError } = await this.supabase
      .from('revisit')
      .insert({
        studyId: `${this.collectionPrefix}${studyId}`,
        docId: 'metadata',
        data: defaultModes,
      });
    if (defaultModesError?.code === '23505') {
      // Another session initialized the record after our read. Preserve its
      // settings and read the winning record instead of replacing it.
      return this.getModes(studyId);
    }
    if (defaultModesError) {
      throw new Error('Failed to update study metadata');
    }
    return defaultModes;
  }

  protected async _setMode(studyId: string, mode: REVISIT_MODE, value: boolean) {
    await this._updateModesFields(studyId, { [mode]: value });
  }

  protected async _setModesDocument(studyId: string, modesDocument: RuntimeStudySettings): Promise<void> {
    const { error } = await this.supabase
      .from('revisit')
      .upsert({
        studyId: `${this.collectionPrefix}${studyId}`,
        docId: 'metadata',
        data: modesDocument,
      })
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'metadata');
    if (error) {
      throw new Error('Failed to update study runtime settings');
    }
  }

  async getStudyHiddenFromLandingPage(studyId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'hideStudyFromLandingPage');
    if (error) {
      throw new Error('Failed to get landing-page visibility');
    }
    return data[0]?.data?.hidden === true;
  }

  async setStudyHiddenFromLandingPage(studyId: string, hidden: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('revisit')
      .upsert({
        studyId: `${this.collectionPrefix}${studyId}`,
        docId: 'hideStudyFromLandingPage',
        data: { hidden },
      })
      .eq('studyId', `${this.collectionPrefix}${studyId}`)
      .eq('docId', 'hideStudyFromLandingPage');
    if (error) {
      throw new Error('Failed to update landing-page visibility');
    }
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

  protected async _getWebcamRecordingUrl(task: string, participantId?: string) {
    await this.verifyStudyDatabase();
    const id = participantId || this.currentParticipantId;
    if (!id) {
      throw new Error('Participant not initialized');
    }

    const webcamRecording = await this._getFromStorage(`/webcamRecording/${id}`, task);
    return webcamRecording ? URL.createObjectURL(webcamRecording) : null;
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
    const [assignments, allocator] = await Promise.all([
      this.supabase
        .from('revisit')
        .select('createdAt, studyId, docId, data')
        .eq('studyId', source)
        .like('docId', 'sequenceAssignment_%'),
      this.supabase
        .from('revisit')
        .select('createdAt, studyId, docId, data')
        .eq('studyId', source)
        .eq('docId', 'sequenceAllocator')
        .maybeSingle(),
    ]);
    if (assignments.error || allocator.error) {
      throw new Error('Failed to copy realtime data');
    }

    // Batch upload the rows to the target study
    const rows = [...assignments.data, allocator.data ?? {
      docId: 'sequenceAllocator',
      data: { ...rebuildSequenceAllocator(assignments.data.map((row) => row.data as SequenceAssignment)), version: 0 },
    }];
    const stageRows = [...new Set(assignments.data.map((row) => (row.data as SequenceAssignment).stage))].map((stage) => {
      const active = assignments.data.map((row) => row.data as SequenceAssignment).filter((assignment) => assignment.stage === stage && consumesCapacity(assignment));
      const combinationCounts: Record<string, number> = {};
      const rowCounts: Record<string, number> = {};
      active.forEach((assignment) => {
        if (assignment.betweenSubjectsCombinationKey) combinationCounts[assignment.betweenSubjectsCombinationKey] = (combinationCounts[assignment.betweenSubjectsCombinationKey] || 0) + 1;
        if (assignment.sequenceKey) rowCounts[assignment.sequenceKey] = (rowCounts[assignment.sequenceKey] || 0) + 1;
      });
      return {
        docId: `stageAllocation_${encodeURIComponent(stage)}`,
        data: {
          count: active.length, combinationCounts, rowCounts, version: 0,
        },
      };
    });
    const toUpload = [...rows, ...stageRows].map((row) => ({
      ...row,
      studyId: target,
    }));
    const { error: uploadError } = await this.supabase
      .from('revisit')
      .upsert(toUpload);
    if (uploadError) {
      throw new Error('Failed to copy realtime data');
    }
  }

  protected async _deleteRealtimeData(target: string) {
    const results = await Promise.all([
      ...['sequenceAssignment_%', 'stageAllocation_%'].map((pattern) => this.supabase.from('revisit').delete().eq('studyId', target).like('docId', pattern)),
      ...['sequenceAllocator', 'currentConfigHash'].map((docId) => this.supabase.from('revisit').delete().eq('studyId', target).eq('docId', docId)),
    ]);
    if (results.some(({ error }) => error)) throw new Error('Failed to delete realtime data');
  }

  protected async _addDirectoryNameToSnapshots(
    directoryName: string,
    studyId: string,
    participantCounts?: SnapshotParticipantCounts,
  ) {
    const snapshots = await this.getSnapshots(studyId);
    if (!snapshots[directoryName]) {
      snapshots[directoryName] = participantCounts
        ? { name: directoryName, participantCounts }
        : { name: directoryName };
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
      snapshots[oldName] = { ...snapshots[oldName], name: newName };
      await this.supabase
        .from('revisit')
        .upsert({
          studyId: `${this.collectionPrefix}${studyId}`,
          docId: 'snapshots',
          data: snapshots,
        });
    }
  }

  protected async _updateSnapshotParticipantCounts(
    snapshotName: string,
    studyId: string,
    participantCounts: SnapshotParticipantCounts,
  ) {
    const snapshots = await this.getSnapshots(studyId);
    if (snapshots[snapshotName]) {
      snapshots[snapshotName] = { ...snapshots[snapshotName], participantCounts };
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
      .maybeSingle();

    if (error) throw new Error(`Failed to read user management data: ${error.message}`);
    if (data === null) return undefined;

    if (!data?.data || typeof data.data !== 'object' || Array.isArray(data.data)) {
      throw new Error('Invalid user management data');
    }
    this.userManagementData = data.data;

    if (key in this.userManagementData) {
      // Type narrowing to ensure correct return type
      if (key === 'authentication') {
        const value = this.userManagementData[key];
        if (value && typeof value === 'object' && 'isEnabled' in value && typeof value.isEnabled === 'boolean') {
          return value as { isEnabled: boolean };
        }
        throw new Error('Invalid authentication setting');
      } else if (key === 'adminUsers') {
        const value = this.userManagementData[key];
        if (value && typeof value === 'object' && 'adminUsersList' in value && Array.isArray(value.adminUsersList)) {
          return value as { adminUsersList: StoredUser[] };
        }
        throw new Error('Invalid administrator list');
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

  async getVerifiedUser(): Promise<StoredUser | null> {
    const { data: sessionData, error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) return null;
    const { data, error } = await this.supabase.auth.getUser();
    if (error) throw error;
    return data.user ? { email: data.user.email ?? null, uid: data.user.id } : null;
  }

  async validateUser(user: UserWrapped | null, refresh = false) {
    const authInfo = await this.getUserManagementData('authentication');
    if (authInfo?.isEnabled !== true) return super.validateUser(user, refresh);
    const verifiedUser = await this.getVerifiedUser();
    if (!verifiedUser || verifiedUser.email !== user?.user?.email || verifiedUser.uid !== user?.user?.uid) return false;
    return super.validateUser(user, refresh);
  }

  async enableAuthentication(rootUser: StoredUser): Promise<StoredUser> {
    const verifiedUser = await this.getVerifiedUser();
    if (!verifiedUser?.email || verifiedUser.email !== rootUser.email || verifiedUser.uid !== rootUser.uid) {
      throw new Error('The signed-in user changed during authentication setup');
    }

    const { data: rows, error: readError } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', '')
      .eq('docId', 'user-management');
    if (readError) throw readError;
    const existingData = rows?.[0]?.data;
    if (rows?.length && (!existingData || typeof existingData !== 'object' || Array.isArray(existingData))) {
      throw new Error('Authentication setup has already started');
    }
    const currentData = (existingData || {}) as Record<string, unknown>;
    const { authentication, adminUsers } = currentData;
    const wasDisabled = authentication !== null && typeof authentication === 'object' && !Array.isArray(authentication)
      && 'isEnabled' in authentication && authentication.isEnabled === false;
    if (rows?.length && ((!wasDisabled && ('authentication' in currentData || 'adminUsers' in currentData))
      || (wasDisabled && adminUsers !== undefined && (!adminUsers || typeof adminUsers !== 'object'
        || !('adminUsersList' in adminUsers) || !Array.isArray(adminUsers.adminUsersList))))) {
      throw new Error('Authentication setup has already started');
    }
    const existingAdmins = wasDisabled && adminUsers
      ? (adminUsers as { adminUsersList: StoredUser[] }).adminUsersList : [];

    const data = {
      ...currentData,
      adminUsers: { adminUsersList: [...existingAdmins.filter((admin) => admin.email !== verifiedUser.email), verifiedUser] },
      authentication: { isEnabled: true },
    };
    if (rows?.length) {
      let query = this.supabase
        .from('revisit')
        .update({ data })
        .eq('studyId', '')
        .eq('docId', 'user-management');
      query = wasDisabled ? query.eq('data', JSON.stringify(currentData))
        : query.is('data->authentication', null).is('data->adminUsers', null);
      const { data: updated, error } = await query.select('docId');
      if (error) throw error;
      if (updated?.length !== 1) throw new Error('Authentication setup has already started');
    } else {
      const { error } = await this.supabase
        .from('revisit')
        .insert({ studyId: '', docId: 'user-management', data });
      if (error) throw error;
    }
    return verifiedUser;
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
    return this.getVerifiedUser();
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
        callback(null).catch((error) => console.error('Supabase auth callback failed:', error));
        return;
      }

      // Only invoke callback if the user actually changed
      if (uid === lastUid) return;
      lastUid = uid;

      callback(user).catch((error) => console.error('Supabase auth callback failed:', error));
    });

    return () => listener.subscription.unsubscribe();
  }

  async logout() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  private async getSequenceAllocatorSeed() {
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }
    const studyId = `${this.collectionPrefix}${this.studyId}`;
    const [totalResult, claimedResult] = await Promise.all([
      this.supabase
        .from('revisit')
        .select('docId', { count: 'exact', head: true })
        .eq('studyId', studyId)
        .like('docId', 'sequenceAssignment_%'),
      this.supabase
        .from('revisit')
        .select('docId', { count: 'exact', head: true })
        .eq('studyId', studyId)
        .like('docId', 'sequenceAssignment_%')
        .eq('data->claimed', true),
    ]);
    if (totalResult.error || claimedResult.error) {
      throw new Error('Failed to initialize sequence assignment allocator');
    }
    return {
      nextSequenceIndex: (totalResult.count ?? 0) - (claimedResult.count ?? 0),
      nextCreationIndex: totalResult.count ?? 0,
      version: 0,
    };
  }

  private async getOrCreateSequenceAllocator(): Promise<SupabaseSequenceAllocator> {
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }
    const studyId = `${this.collectionPrefix}${this.studyId}`;
    const allocatorPath = 'sequenceAllocator';
    const { data: existingAllocator, error: existingAllocatorError } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', studyId)
      .eq('docId', allocatorPath)
      .maybeSingle();
    if (existingAllocatorError) {
      throw new Error('Failed to retrieve sequence assignment allocator');
    }
    if (existingAllocator) {
      return existingAllocator.data as SupabaseSequenceAllocator;
    }

    const seed = await this.getSequenceAllocatorSeed();
    const { error } = await this.supabase
      .from('revisit')
      .insert({ studyId, docId: allocatorPath, data: seed });
    if (error && error.code !== '23505') {
      throw new Error('Failed to create sequence assignment allocator');
    }

    const { data: allocator, error: allocatorError } = await this.supabase
      .from('revisit')
      .select('data')
      .eq('studyId', studyId)
      .eq('docId', allocatorPath)
      .single();
    if (allocatorError || !allocator) {
      throw new Error('Failed to retrieve sequence assignment allocator');
    }
    return allocator.data as typeof seed;
  }

  private async reserveSequenceAllocator(
    initialAllocator: SupabaseSequenceAllocator,
    reusableSequenceIndex?: number,
    incrementCreationIndex: boolean = true,
  ): Promise<SequenceAssignmentAllocation> {
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }
    const studyId = `${this.collectionPrefix}${this.studyId}`;
    const allocatorPath = 'sequenceAllocator';

    for (let attempt = 0; attempt < SEQUENCE_ALLOCATION_ATTEMPTS; attempt += 1) {
      let allocator = initialAllocator;
      if (attempt > 0) {
        // eslint-disable-next-line no-await-in-loop
        await waitForAllocationRetry(attempt);
        // eslint-disable-next-line no-await-in-loop
        const { data, error } = await this.supabase
          .from('revisit')
          .select('data')
          .eq('studyId', studyId)
          .eq('docId', allocatorPath)
          .single();
        if (error || !data) {
          throw new Error('Failed to retrieve sequence assignment allocator');
        }
        allocator = data.data as SupabaseSequenceAllocator;
      }

      const availableSequenceIndex = incrementCreationIndex ? allocator.availableSequenceIndexes?.[0] : undefined;
      const sequenceIndex = reusableSequenceIndex ?? availableSequenceIndex ?? allocator.nextSequenceIndex;
      const creationIndex = allocator.nextCreationIndex;
      const nextAllocator = {
        ...allocator,
        ...(availableSequenceIndex !== undefined && reusableSequenceIndex === undefined ? {
          availableSequenceIndexes: allocator.availableSequenceIndexes?.slice(1),
        } : {}),
        nextSequenceIndex: reusableSequenceIndex === undefined && availableSequenceIndex === undefined
          ? allocator.nextSequenceIndex + 1
          : allocator.nextSequenceIndex,
        nextCreationIndex: incrementCreationIndex
          ? allocator.nextCreationIndex + 1
          : allocator.nextCreationIndex,
        version: allocator.version + 1,
      };
      // eslint-disable-next-line no-await-in-loop
      const { data: updatedAllocatorRows, error } = await this.supabase
        .from('revisit')
        .update({ data: nextAllocator })
        .eq('studyId', studyId)
        .eq('docId', allocatorPath)
        .eq('data->version', allocator.version)
        .select('data');
      if (error) {
        throw new Error('Failed to reserve a sequence assignment');
      }
      if (updatedAllocatorRows?.length === 1) {
        return { sequenceIndex, creationIndex };
      }
    }

    throw new Error('Failed to reserve a sequence assignment after concurrent updates');
  }

  private async getLegacySequenceIndex(timestamp: number) {
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }
    const studyId = `${this.collectionPrefix}${this.studyId}`;
    const [serverTimestampResult, storedTimestampResult] = await Promise.all([
      this.supabase
        .from('revisit')
        .select('docId', { count: 'exact', head: true })
        .eq('studyId', studyId)
        .like('docId', 'sequenceAssignment_%')
        .eq('data->rejected', false)
        .eq('data->withServerTimestamp', true)
        .lt('createdAt', new Date(timestamp).toISOString()),
      this.supabase
        .from('revisit')
        .select('docId', { count: 'exact', head: true })
        .eq('studyId', studyId)
        .like('docId', 'sequenceAssignment_%')
        .eq('data->rejected', false)
        .eq('data->withServerTimestamp', false)
        .lt('data->timestamp', timestamp),
    ]);
    if (serverTimestampResult.error || storedTimestampResult.error) {
      throw new Error('Failed to derive legacy sequence assignment index');
    }
    return (serverTimestampResult.count ?? 0) + (storedTimestampResult.count ?? 0);
  }

  private async getLegacyCreationIndex(createdTime: number) {
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }
    const { count, error } = await this.supabase
      .from('revisit')
      .select('docId', { count: 'exact', head: true })
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`)
      .like('docId', 'sequenceAssignment_%')
      .lt('createdAt', new Date(createdTime).toISOString());
    if (error) {
      throw new Error('Failed to derive legacy participant creation index');
    }
    return count ?? 0;
  }

  protected async _allocateSequenceAssignment(
    participantId: string,
    sequenceAssignment: SequenceAssignment,
  ): Promise<SequenceAssignmentAllocation> {
    return retrySequenceAllocation(() => this.tryAllocateSequenceAssignment(participantId, sequenceAssignment));
  }

  private async tryAllocateSequenceAssignment(
    participantId: string,
    sequenceAssignment: SequenceAssignment,
  ): Promise<SequenceAssignmentAllocation | null> {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const existingAssignment = await this._getSequenceAssignment(participantId);
    if (existingAssignment && !existingAssignment.rejected) {
      if (
        existingAssignment.sequenceIndex !== undefined
        && existingAssignment.creationIndex !== undefined
      ) {
        return {
          sequenceIndex: existingAssignment.sequenceIndex,
          creationIndex: existingAssignment.creationIndex,
        };
      }

      const [sequenceIndex, creationIndex] = await Promise.all([
        this.getLegacySequenceIndex(existingAssignment.timestamp),
        this.getLegacyCreationIndex(existingAssignment.createdTime),
      ]);
      return {
        sequenceIndex,
        creationIndex,
      };
    }

    const studyId = `${this.collectionPrefix}${this.studyId}`;
    const [serverTimestampResult, storedTimestampResult, initialAllocator] = await Promise.all([
      this.supabase
        .from('revisit')
        .select('docId, data, createdAt')
        .eq('studyId', studyId)
        .like('docId', 'sequenceAssignment_%')
        .eq('data->rejected', true)
        .eq('data->claimed', false)
        .neq('docId', `sequenceAssignment_${participantId}`)
        .eq('data->withServerTimestamp', true)
        .order('createdAt', { ascending: true })
        .limit(1)
        .maybeSingle(),
      this.supabase
        .from('revisit')
        .select('docId, data, createdAt')
        .eq('studyId', studyId)
        .like('docId', 'sequenceAssignment_%')
        .eq('data->rejected', true)
        .eq('data->claimed', false)
        .neq('docId', `sequenceAssignment_${participantId}`)
        .eq('data->withServerTimestamp', false)
        .order('data->timestamp', { ascending: true })
        .limit(1)
        .maybeSingle(),
      this.getOrCreateSequenceAllocator(),
    ]);
    if (serverTimestampResult.error || storedTimestampResult.error) {
      throw new Error('Failed to retrieve rejected sequence assignment');
    }
    const reusableRow = [serverTimestampResult.data, storedTimestampResult.data]
      .filter((row) => row !== null)
      .sort((a, b) => {
        const aTimestamp = a.data.withServerTimestamp ? new Date(a.createdAt).getTime() : a.data.timestamp;
        const bTimestamp = b.data.withServerTimestamp ? new Date(b.createdAt).getTime() : b.data.timestamp;
        return aTimestamp - bTimestamp;
      })[0];

    const reusableAssignment = reusableRow?.data as SequenceAssignment | undefined;
    let reusableSequenceIndex = reusableAssignment?.reusableSequenceIndex
      ?? reusableAssignment?.sequenceIndex;
    if (reusableAssignment && reusableSequenceIndex === undefined) {
      const reusableTimestamp = (reusableAssignment as SequenceAssignment & {
        withServerTimestamp?: boolean;
      }).withServerTimestamp
        ? new Date(reusableRow!.createdAt).getTime()
        : reusableAssignment.timestamp;
      reusableSequenceIndex = await this.getLegacySequenceIndex(reusableTimestamp);
    }

    if (reusableRow && reusableAssignment && reusableSequenceIndex !== undefined) {
      const { data: claimedRows, error: claimError } = await this.supabase
        .from('revisit')
        .update({
          data: {
            ...reusableAssignment,
            claimed: true,
            sequenceIndex: reusableSequenceIndex,
          },
        })
        .eq('studyId', studyId)
        .eq('docId', reusableRow.docId)
        .eq('data->rejected', true)
        .eq('data->claimed', false)
        .select('data');
      if (claimError) {
        throw new Error('Failed to claim rejected sequence assignment');
      }
      if (!claimedRows || claimedRows.length === 0) {
        return null;
      }
    }

    const allocation = await this.reserveSequenceAllocator(
      initialAllocator,
      reusableSequenceIndex,
    );

    await this._createSequenceAssignment(participantId, {
      ...sequenceAssignment,
      ...(reusableRow && reusableAssignment ? {
        timestamp: (reusableAssignment as SequenceAssignment & { withServerTimestamp?: boolean }).withServerTimestamp
          ? new Date(reusableRow.createdAt).getTime()
          : reusableAssignment.timestamp,
        claimedParticipantId: reusableAssignment.participantId,
      } : {}),
      sequenceIndex: allocation.sequenceIndex,
      creationIndex: allocation.creationIndex,
    }, !reusableAssignment);
    return allocation;
  }

  private async returnSequenceIndex(sequenceIndex: number) {
    const studyId = `${this.collectionPrefix}${this.studyId}`;
    for (let attempt = 0; attempt < SEQUENCE_ALLOCATION_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        // eslint-disable-next-line no-await-in-loop
        await waitForAllocationRetry(attempt);
      }
      // eslint-disable-next-line no-await-in-loop
      const allocator = await this.getOrCreateSequenceAllocator();
      const nextAllocator: SupabaseSequenceAllocator = {
        ...allocator,
        availableSequenceIndexes: [...new Set([
          ...(allocator.availableSequenceIndexes ?? []), sequenceIndex,
        ])].sort((a, b) => a - b),
        version: allocator.version + 1,
      };
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await this.supabase
        .from('revisit')
        .update({ data: nextAllocator })
        .eq('studyId', studyId)
        .eq('docId', 'sequenceAllocator')
        .eq('data->version', allocator.version)
        .select('data');
      if (error) {
        throw new Error('Failed to return an unused sequence assignment');
      }
      if (data?.length === 1) {
        return;
      }
    }
    throw new Error('Failed to return an unused sequence assignment after concurrent updates');
  }

  protected override async hasStageAssignments(stage: string): Promise<boolean> {
    const { count, error } = await this.supabase.from('revisit').select('docId', { count: 'exact', head: true })
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`).like('docId', 'sequenceAssignment_%')
      .eq('data->stage', stage);
    if (error) throw new Error('Failed to check stage assignment history');
    return (count || 0) > 0;
  }

  private async countStageAssignments(stage: string, filter?: { field: 'sequenceKey' | 'betweenSubjectsCombinationKey'; value: string }): Promise<number> {
    const request = this.supabase.from('revisit').select('docId', { count: 'exact', head: true })
      .eq('studyId', `${this.collectionPrefix}${this.studyId}`).like('docId', 'sequenceAssignment_%')
      .eq('data->stage', stage)
      .eq('data->rejected', false)
      .is('data->>autoTimedOutAt', null);
    const { count, error } = await (filter ? request.eq(`data->${filter.field}`, filter.value) : request);
    if (error) throw new Error('Failed to count stage assignments');
    return count ?? 0;
  }

  protected override async getStageAllocation(stage: string, conditionKeys: string[] = []): Promise<StageAllocation> {
    return this._runWithLock(`stage-allocation-${stage}`, () => this.readStageAllocation(stage, conditionKeys));
  }

  // Callers hold the stage lock, including while a timeout writes its assignment.
  private async readStageAllocation(stage: string, conditionKeys: string[] = []): Promise<SupabaseStageAllocation> {
    const studyId = `${this.collectionPrefix}${this.studyId}`;
    const docId = `stageAllocation_${encodeURIComponent(stage)}`;
    const { data, error } = await this.supabase.from('revisit').select('data').eq('studyId', studyId).eq('docId', docId)
      .maybeSingle();
    if (error) throw new Error('Failed to read stage allocation');
    if (data) {
      const current = data.data as SupabaseStageAllocation;
      if (!current.needsRebuild) return current;
      // Recount the cached keys with server aggregates, avoiding a participant
      // history download (and its API row limit) during recovery.
      const combinationKeys = Object.keys(current.combinationCounts);
      const rowKeys = Object.keys(current.rowCounts);
      const [count, combinations, rows] = await Promise.all([
        this.countStageAssignments(stage),
        Promise.all(combinationKeys.map((value) => this.countStageAssignments(stage, { field: 'betweenSubjectsCombinationKey', value }))),
        Promise.all(rowKeys.map((value) => this.countStageAssignments(stage, { field: 'sequenceKey', value }))),
      ]);
      const rebuilt = {
        ...current,
        count,
        combinationCounts: Object.fromEntries(combinationKeys.map((key, index) => [key, combinations[index]])),
        rowCounts: Object.fromEntries(rowKeys.map((key, index) => [key, rows[index]])),
        needsRebuild: false,
        version: current.version + 1,
      };
      const result = await this.supabase.from('revisit').update({ data: rebuilt })
        .eq('studyId', studyId).eq('docId', docId)
        .eq('data->version', current.version)
        .select('docId');
      if (result.error || result.data?.length !== 1) throw new Error('Failed to rebuild stage allocation');
      return rebuilt;
    }
    const counts = await Promise.all([undefined, ...conditionKeys].map((value) => this.countStageAssignments(stage, value === undefined ? undefined : { field: 'betweenSubjectsCombinationKey', value })));
    const initial = {
      count: counts[0], combinationCounts: Object.fromEntries(conditionKeys.map((key, index) => [key, counts[index + 1]])), rowCounts: {}, version: 0,
    };
    const { error: insertError } = await this.supabase.from('revisit').insert({ studyId, docId, data: initial });
    if (insertError && insertError.code !== '23505') throw new Error('Failed to initialize stage allocation');
    if (!insertError) return initial;
    return this.readStageAllocation(stage, conditionKeys);
  }

  private async changeStageCounts(previous: SequenceAssignment | null, next: SequenceAssignment, write: () => Promise<void>, rebuildAfterWrite = false) {
    const affected = [...new Set([previous?.stage, next.stage].filter((stage): stage is string => stage !== undefined))].sort();
    const changes = affected.map((stage) => ({
      stage,
      // Rejected and auto-timed-out assignments have released their slot.
      before: previous?.stage === stage && consumesCapacity(previous) ? previous : undefined,
      after: next.stage === stage && consumesCapacity(next) ? next : undefined,
    })).filter(({ before, after }) => Boolean(before) !== Boolean(after) || before?.sequenceKey !== after?.sequenceKey || before?.betweenSubjectsCombinationKey !== after?.betweenSubjectsCombinationKey);
    const updateCounts = async () => {
      await Promise.all(changes.map(({ stage }) => this.readStageAllocation(stage)));
      if (rebuildAfterWrite) {
        for (const { stage } of changes) {
          // Persist invalidation BEFORE the assignment write. Any interrupted or
          // unacknowledged write is reconciled from assignments by the next reader.
          // eslint-disable-next-line no-await-in-loop
          const current = await this.readStageAllocation(stage);
          // eslint-disable-next-line no-await-in-loop
          const result = await this.supabase.from('revisit').update({ data: { ...current, needsRebuild: true, version: current.version + 1 } })
            .eq('studyId', `${this.collectionPrefix}${this.studyId}`).eq('docId', `stageAllocation_${encodeURIComponent(stage)}`)
            .eq('data->version', current.version)
            .select('docId');
          if (result.error || result.data?.length !== 1) throw new Error('Failed to invalidate stage allocation');
        }
      }
      await write();
      if (rebuildAfterWrite) {
        await Promise.all(changes.map(({ stage }) => this.readStageAllocation(stage)));
        return;
      }
      for (const { stage, before, after } of changes) {
        let saved = false;
        for (let attempt = 0; attempt < SEQUENCE_ALLOCATION_ATTEMPTS && !saved; attempt += 1) {
          // eslint-disable-next-line no-await-in-loop
          const current = await this.readStageAllocation(stage);
          const combinationCounts = { ...current.combinationCounts };
          const rowCounts = { ...current.rowCounts };
          if (before?.betweenSubjectsCombinationKey) combinationCounts[before.betweenSubjectsCombinationKey] = Math.max(0, (combinationCounts[before.betweenSubjectsCombinationKey] || 0) - 1);
          if (after?.betweenSubjectsCombinationKey) combinationCounts[after.betweenSubjectsCombinationKey] = (combinationCounts[after.betweenSubjectsCombinationKey] || 0) + 1;
          if (before?.sequenceKey) rowCounts[before.sequenceKey] = Math.max(0, (rowCounts[before.sequenceKey] || 0) - 1);
          if (after?.sequenceKey) rowCounts[after.sequenceKey] = (rowCounts[after.sequenceKey] || 0) + 1;
          // eslint-disable-next-line no-await-in-loop
          const result = await this.supabase.from('revisit').update({
            data: {
              count: Math.max(0, current.count + Number(Boolean(after)) - Number(Boolean(before))), combinationCounts, rowCounts, version: current.version + 1,
            },
          }).eq('studyId', `${this.collectionPrefix}${this.studyId}`).eq('docId', `stageAllocation_${encodeURIComponent(stage)}`)
            .eq('data->version', current.version)
            .select('docId');
          if (result.error) throw new Error('Failed to update stage allocation');
          saved = result.data?.length === 1;
        }
        if (!saved) throw new Error('Failed to update stage allocation after concurrent changes');
      }
    };
    const withStageLocks = async (index: number): Promise<void> => {
      if (index === changes.length) return updateCounts();
      return this._runWithLock(`stage-allocation-${changes[index].stage}`, () => withStageLocks(index + 1));
    };
    await withStageLocks(0);
  }
}

type SupabaseSequenceAllocator = SequenceAllocator & {
  version: number;
};

// A timeout invalidates its cached counts durably until a reader rebuilds them.
type SupabaseStageAllocation = StageAllocation & { version: number; needsRebuild?: boolean };
