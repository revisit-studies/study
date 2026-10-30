import { parse as hjsonParse } from 'hjson';
import sha256 from 'crypto-js/sha256';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { initializeApp } from 'firebase/app';
import {
  deleteObject, getBlob, getDownloadURL, getStorage, ref, uploadBytes, listAll, FirebaseStorage, updateMetadata,
} from 'firebase/storage';
import {
  CollectionReference, DocumentData, Firestore, FieldPath, Transaction, Timestamp, collection, deleteField, doc, enableNetwork, getDoc, getDocs, getDocsFromServer, initializeFirestore, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, getCountFromServer, limit, orderBy, query, where,
} from 'firebase/firestore';
import { ReCaptchaV3Provider, ReCaptchaEnterpriseProvider, initializeAppCheck } from '@firebase/app-check';
import {
  browserPopupRedirectResolver, getAuth, GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut,
} from '@firebase/auth';
import { isParticipantData, rebuildSequenceAllocator, retrySequenceAllocation } from './utils/storageEngineHelpers';
import {
  StageAllocation, CloudStorageEngine, REVISIT_MODE, StorageObjectType, StorageObject, UserManagementData, SequenceAssignment, SnapshotDocContent, StoredUser, RuntimeStudySettings, cleanupModes, consumesCapacity, isStageParticipantLimitEnabled, ModesAndStageData, StageInfo, StageUpdates, StageData, applyStageUpdates, StageCapacityExceededError, StageNoAvailableConditionsError, StageOnlyDisabledConditionsHaveCapacityError, getBetweenSubjectsCombinationKey, getConfigConditionKeys, getDesiredParticipantCountsByCombination, getLeastServedSequence, getStageParticipantCounts, isSequenceEnabledForStage, assertAppendOnlyConditions, validateStageParticipantLimits, SequenceAssignmentAllocation, SequenceAllocator,
} from './types';
import { EditedText, TaglessEditedText } from '../../analysis/individualStudy/thinkAloud/types';
import { DISTINCT_COLOR_PALETTE } from '../../utils/colors';
import { StudyConfig } from '../../parser/types';
import { Sequence } from '../../store/types';
import { ParticipantData } from '../types';
import { SnapshotParticipantCounts } from './utils/snapshotParticipantCounts';

type AllocationState = {
  revision: number;
  nextCreationIndex: number;
  assignments: SequenceAssignment[];
  allocator: SequenceAllocator;
  hasAllocator: boolean;
};

export class FirebaseStorageEngine extends CloudStorageEngine {
  protected override hasAtomicSequenceReservation = true;

  private assignmentReference(participantId: string) {
    return doc(collection(doc(this.studyCollection, 'sequenceAssignment'), 'sequenceAssignment'), participantId);
  }

  private stageAllocationReference(stage: string, studyCollection = this.studyCollection) {
    return doc(collection(doc(studyCollection, 'allocation'), 'stages'), sha256(stage).toString());
  }

  private async readAllocation(transaction: Transaction, studyCollection = this.studyCollection): Promise<AllocationState> {
    const revision = await transaction.get(doc(studyCollection, 'allocation'));
    const allocator = await transaction.get(doc(studyCollection, 'sequenceAssignmentAllocator'));
    // Every reservation/rejection/restoration writes this revision in its transaction.
    // A concurrent assignment change invalidates the query below and retries the
    // transaction. This lets the existing assignment collection remain authoritative
    // without trusting browser clocks or querying a collection through Transaction.get.
    const snapshot = await getDocsFromServer(collection(doc(studyCollection, 'sequenceAssignment'), 'sequenceAssignment'));
    const assignments = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        ...data,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : data.timestamp,
        createdTime: data.createdTime instanceof Timestamp ? data.createdTime.toMillis() : data.createdTime,
        completed: data.completed instanceof Timestamp ? data.completed.toMillis() : data.completed,
      } as SequenceAssignment;
    }).sort((a, b) => a.timestamp - b.timestamp);
    return {
      revision: revision.data()?.revision ?? 0,
      nextCreationIndex: Math.max((allocator.data() as SequenceAllocator | undefined)?.nextCreationIndex ?? 0, rebuildSequenceAllocator(assignments).nextCreationIndex),
      allocator: (allocator.data() as SequenceAllocator | undefined) ?? rebuildSequenceAllocator(assignments),
      hasAllocator: allocator.exists(),
      assignments,
    };
  }

  private writeAllocation(transaction: Transaction, state: AllocationState, stage: string, conditionKeys?: string[], studyCollection = this.studyCollection) {
    transaction.set(doc(studyCollection, 'allocation'), {
      revision: state.revision + 1,
      nextCreationIndex: state.nextCreationIndex,
    });
    if (state.hasAllocator) transaction.set(doc(studyCollection, 'sequenceAssignmentAllocator'), { ...state.allocator, nextCreationIndex: state.nextCreationIndex });
    const rowCounts: Record<string, number> = {};
    const counts: Record<string, number> = {};
    state.assignments.filter((assignment) => assignment.stage === stage && consumesCapacity(assignment)).forEach((assignment) => {
      if (assignment.sequenceKey) rowCounts[assignment.sequenceKey] = (rowCounts[assignment.sequenceKey] || 0) + 1;
      const key = assignment.betweenSubjectsCombinationKey;
      if (key !== undefined) counts[key] = (counts[key] || 0) + 1;
    });
    transaction.set(this.stageAllocationReference(stage, studyCollection), {
      count: getStageParticipantCounts(state.assignments)[stage] || 0,
      combinationCounts: counts,
      rowCounts,
      ...(conditionKeys === undefined ? {} : { conditionKeys }),
    }, { mergeFields: ['count', 'combinationCounts', 'rowCounts', ...(conditionKeys === undefined ? [] : ['conditionKeys'])] });
  }

  protected override async _getSequence(conditions: string[] | undefined, bootstrapData: ModesAndStageData, config: StudyConfig, participantConfigHash: string) {
    if (!bootstrapData.modes.dataCollectionEnabled) return super._getSequence(conditions, bootstrapData, config, participantConfigHash);
    const sequences = bootstrapData.sequenceArray ?? await this.getSequenceArray(await this._getCurrentConfigHash() ? participantConfigHash : undefined);
    if (!sequences?.length) throw new Error('Latin square not initialized');
    const participantId = this.currentParticipantId!;
    const conditionKeys = getConfigConditionKeys(config);
    const betweenSubjects = config.betweenSubjects || [];
    const reservationToken = uuidv4();
    const assignments = collection(doc(this.studyCollection, 'sequenceAssignment'), 'sequenceAssignment');
    const allocatorReference = doc(this.studyCollection, 'sequenceAssignmentAllocator');
    const existing = await this._getSequenceAssignment(participantId);
    if (existing && !existing.rejected && !existing.initialization) {
      const allocation = await this._allocateSequenceAssignment(participantId, existing);
      const prefix = `${participantConfigHash}:`;
      const currentRow = existing.sequenceKey?.startsWith(prefix) ? sequences[Number(existing.sequenceKey.slice(prefix.length))]
        : existing.sequenceKey === undefined ? sequences[allocation.sequenceIndex % sequences.length] : undefined;
      if (!currentRow) throw new Error('The unfinished reservation uses a different study configuration. Please contact the study administrator.');
      return { currentRow, creationIndex: allocation.creationIndex + 1, stage: existing.stage };
    }
    return retrySequenceAllocation(async () => {
      const { stageData } = await this.getModesAndStageData(this.studyId!);
      await this.getStageAllocation(stageData.currentStage.stageName, conditionKeys);
      const allocatorSnapshot = await getDoc(allocatorReference);
      const seed = allocatorSnapshot.exists() ? allocatorSnapshot.data() as SequenceAllocator : await this.getSequenceAllocatorSeed(assignments);
      const candidates = await Promise.all([0, Timestamp.fromMillis(0)].map((threshold) => getDocs(query(
        assignments,
        where('rejected', '==', true),
        where('claimed', '==', false),
        where('timestamp', '>=', threshold),
        orderBy('timestamp', 'asc'),
        limit(2),
      ))));
      const candidate = candidates.flatMap((snapshot) => snapshot.docs).filter((item) => item.id !== participantId).sort((a, b) => {
        const left = a.data().timestamp; const right = b.data().timestamp;
        return (left instanceof Timestamp ? left.toMillis() : left) - (right instanceof Timestamp ? right.toMillis() : right);
      })[0];
      const sourceData = candidate?.data() as SequenceAssignment | undefined;
      const legacyIndex = sourceData && sourceData.sequenceIndex === undefined && sourceData.reusableSequenceIndex === undefined
        ? await this.getLegacySequenceIndex(assignments, sourceData.timestamp) : undefined;
      return runTransaction(this.firestore, async (transaction) => {
        const revision = await transaction.get(doc(this.studyCollection, 'allocation'));
        const modesReference = doc(this.studyCollection, 'modes');
        const modes = (await transaction.get(modesReference)).data();
        if (!modes?.dataCollectionEnabled) throw new Error('Study settings changed while joining. Please reload.');
        const stages = modes.stage as StageData;
        const stage = stages.allStages.find((item) => item.stageName === stages.currentStage.stageName)!;
        const own = (await transaction.get(this.assignmentReference(participantId))).data() as SequenceAssignment | undefined;
        const allocator = ((await transaction.get(allocatorReference)).data() ?? seed) as SequenceAllocator;
        const stageSnapshot = await transaction.get(this.stageAllocationReference(stage.stageName));
        const source = candidate ? (await transaction.get(this.assignmentReference(candidate.id))).data() as SequenceAssignment | undefined : undefined;
        if (!stageSnapshot.exists()) return null;
        const state = { rowCounts: {}, ...stageSnapshot.data() } as StageAllocation;
        if (own && !own.rejected) {
          const prefix = `${participantConfigHash}:`;
          const row = own.sequenceKey?.startsWith(prefix) ? sequences[Number(own.sequenceKey.slice(prefix.length))]
            : own.sequenceKey === undefined && own.sequenceIndex !== undefined ? sequences[own.sequenceIndex % sequences.length] : undefined;
          if (!row || own.creationIndex === undefined) throw new Error('The unfinished reservation uses a different study configuration. Please contact the study administrator.');
          if (own.initialization && !own.initialization.complete) transaction.update(this.assignmentReference(participantId), { initialization: { pending: [...own.initialization.pending, reservationToken], complete: false } });
          return {
            currentRow: row, creationIndex: own.creationIndex + 1, stage: own.stage, reservationToken,
          };
        }
        if (stage.conditionKeys?.length && JSON.stringify(stage.conditionKeys) !== JSON.stringify(conditionKeys) && await this.hasStageAssignments(stage.stageName)) assertAppendOnlyConditions(stage.conditionKeys || [], conditionKeys);
        if (isStageParticipantLimitEnabled(stage) && state.count >= stage.maxParticipants) throw new StageCapacityExceededError(stage.stageName);
        const enabled = sequences.filter((row) => isSequenceEnabledForStage(row, stage, betweenSubjects));
        if (!enabled.length) throw new StageNoAvailableConditionsError(stage.stageName);
        const targets = getDesiredParticipantCountsByCombination(stage, sequences, betweenSubjects);
        const hasCapacity = (row: Sequence) => !targets || (state.combinationCounts[getBetweenSubjectsCombinationKey(row.parameters, betweenSubjects)] || 0) < targets[getBetweenSubjectsCombinationKey(row.parameters, betweenSubjects)];
        const eligible = enabled.filter(hasCapacity);
        if (!eligible.length) {
          if (sequences.some((row) => !isSequenceEnabledForStage(row, stage, betweenSubjects) && hasCapacity(row))) throw new StageOnlyDisabledConditionsHaveCapacityError(stage.stageName);
          throw new StageCapacityExceededError(stage.stageName);
        }
        if (candidate && (!source?.rejected || source.claimed)) return null;
        const sequenceIndex = source ? source.reusableSequenceIndex ?? source.sequenceIndex ?? legacyIndex : allocator.availableSequenceIndexes?.[0] ?? allocator.nextSequenceIndex;
        if (sequenceIndex === undefined) throw new Error('Unable to determine sequence assignment index');
        const rowCounts = new Map(sequences.map((row, index) => [row, state.rowCounts[`${participantConfigHash}:${index}`] || 0]));
        const row = betweenSubjects.length ? getLeastServedSequence(eligible, state.combinationCounts, targets, betweenSubjects, state.count, rowCounts) : eligible[sequenceIndex % eligible.length];
        const key = getBetweenSubjectsCombinationKey(row.parameters, betweenSubjects);
        const sequenceKey = `${participantConfigHash}:${sequences.indexOf(row)}`;
        const assignment: SequenceAssignment = {
          participantId,
          timestamp: Date.now(),
          createdTime: Date.now(),
          rejected: false,
          claimed: false,
          completed: null,
          total: 0,
          answered: [],
          isDynamic: false,
          stage: stage.stageName,
          ...(conditions ? { conditions } : {}),
          ...(source && candidate ? { claimedParticipantId: candidate.id } : {}),
          betweenSubjectsCombinationKey: key,
          sequenceKey,
          sequenceIndex,
          creationIndex: allocator.nextCreationIndex,
          initialization: { pending: [reservationToken], complete: false },
        };
        if (source && candidate) transaction.update(this.assignmentReference(candidate.id), { claimed: true, sequenceIndex });
        transaction.set(this.assignmentReference(participantId), { ...assignment, timestamp: source ? source.timestamp : serverTimestamp(), createdTime: serverTimestamp() });
        transaction.set(allocatorReference, {
          ...allocator,
          ...(allocator.availableSequenceIndexes ? { availableSequenceIndexes: source ? allocator.availableSequenceIndexes : allocator.availableSequenceIndexes.slice(1) } : {}),
          nextSequenceIndex: source || allocator.availableSequenceIndexes?.length ? allocator.nextSequenceIndex : allocator.nextSequenceIndex + 1,
          nextCreationIndex: allocator.nextCreationIndex + 1,
        });
        transaction.set(this.stageAllocationReference(stage.stageName), {
          ...stageSnapshot.data(),
          count: state.count + 1,
          combinationCounts: { ...state.combinationCounts, [key]: (state.combinationCounts[key] || 0) + 1 },
          rowCounts: { ...state.rowCounts, [sequenceKey]: (state.rowCounts[sequenceKey] || 0) + 1 },
          conditionKeys,
        });
        transaction.set(doc(this.studyCollection, 'allocation'), { revision: (revision.data()?.revision || 0) + 1, nextCreationIndex: allocator.nextCreationIndex + 1 });
        transaction.set(modesReference, { stage: { ...stages, allStages: stages.allStages.map((item) => (item.stageName === stage.stageName ? { ...item, conditionKeys } : item)) } }, { merge: true });
        return {
          currentRow: row, creationIndex: allocator.nextCreationIndex + 1, stage: stage.stageName, reservationToken,
        };
      });
    });
  }

  protected override async confirmParticipantReservation(participant: ParticipantData, reservationToken?: string, fromCache = false) {
    return runTransaction(this.firestore, async (transaction) => {
      const reference = this.assignmentReference(participant.participantId);
      const assignment = (await transaction.get(reference)).data() as SequenceAssignment | undefined;
      if (!assignment?.initialization) return true;
      if (assignment.creationIndex === undefined || assignment.creationIndex + 1 !== participant.participantIndex) return false;
      if (assignment.initialization.complete) return true;
      if (fromCache) return false; // A cached first write does not prove that its upload succeeded.
      if (assignment.rejected || (reservationToken && !assignment.initialization.pending.includes(reservationToken))) return false;
      transaction.update(reference, { initialization: { pending: [], complete: true } });
      return true;
    });
  }

  protected override async releaseInitialSequenceAssignment(reservation?: { creationIndex: number; reservationToken?: string }) {
    // A failed transaction created no reservation. A failed upload may only remove
    // its own pending attempt, never a concurrent upload or a confirmed session.
    if (!reservation?.reservationToken || !this.currentParticipantId) return;
    try {
      await this.rejectAssignment(this.currentParticipantId, false, {
        creationIndex: reservation.creationIndex,
        reservationToken: reservation.reservationToken,
      });
    } catch (error) {
      console.warn('Error releasing the sequence assignment of a failed participant initialization:', error);
    }
  }

  private firestore: Firestore;

  private studyCollection: CollectionReference<DocumentData, DocumentData>;

  private storage: FirebaseStorage;

  protected participantStore = localforage.createInstance({
    name: 'revisit-firebase',
  });

  constructor(testing: boolean = false) {
    super('firebase', testing);

    const firebaseConfig = hjsonParse(import.meta.env.VITE_FIREBASE_CONFIG);
    const firebaseApp = initializeApp(firebaseConfig);
    // Force long-polling instead of letting the SDK auto-detect the transport.
    // By default the WebChannel backchannel is held open in case the backend has
    // more data to send. Safari buffers that response rather than delivering it
    // incrementally, so listener data and write acknowledgements only surface
    // when the request eventually times out -- stalling study loads by 30-50s and
    // hanging the end-of-study upload for exactly 30s. Forcing long-polling closes
    // the request as soon as the backend sends data, costing one extra round trip
    // per message. Note this cannot be combined with
    // experimentalAutoDetectLongPolling, which is enabled by default and does not
    // prevent the stall.
    this.firestore = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    });
    this.studyCollection = collection(
      this.firestore,
      '_revisit',
    );
    this.storage = getStorage();

    // Check if we're in dev, if so use a debug token
    if (import.meta.env.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    try {
      initializeAppCheck(firebaseApp, {
        // Opt in separately so existing deployments keep their v3 provider and key.
        provider: import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
          ? new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY)
          : new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHAV3TOKEN),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      console.warn('Failed to initialize Firebase App Check');
    }
  }

  protected async _getFromStorage<T extends StorageObjectType>(prefix: string, type: T, studyId?: string, strict = false) {
    const storageRef = ref(
      this.storage,
      `${this.collectionPrefix}${studyId || this.studyId}/${prefix}_${type}`,
    );

    let storageObj: StorageObject<T> = {} as StorageObject<T>;
    try {
      const blob = await getBlob(storageRef);
      const fullProvStr = await blob.text();
      storageObj = JSON.parse(fullProvStr);
      if (type === 'participantData' && !isParticipantData(storageObj)) throw new Error('Invalid participant data');
    } catch (error) {
      // Only confirmed absence may trigger replacement, orphan cleanup, or a legacy fallback.
      if ((strict || type === 'sequenceArray' || type === 'participantData') && (error as { code?: string } | null)?.code !== 'storage/object-not-found') throw error;
      console.warn(
        `${prefix} does not have ${type} for ${this.collectionPrefix}${this.studyId}.`,
      );
    }

    return storageObj;
  }

  protected async _pushToStorage<T extends StorageObjectType>(prefix: string, type: T, objectToUpload: StorageObject<T>) {
    const storageRef = ref(
      this.storage,
      `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`,
    );

    if (objectToUpload instanceof Blob) {
      await uploadBytes(storageRef, objectToUpload);
    } else if (Object.keys(objectToUpload).length > 0) {
      const blob = new Blob([JSON.stringify(objectToUpload)], {
        type: 'application/json',
      });
      await uploadBytes(storageRef, blob);
    }
  }

  protected async _deleteFromStorage<T extends StorageObjectType>(
    prefix: string,
    type: T,
  ) {
    const storageRef = ref(
      this.storage,
      `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`,
    );
    await deleteObject(storageRef);
  }

  protected async _cacheStorageObject<T extends StorageObjectType>(prefix: string, type: T) {
    const storageRef = ref(
      this.storage,
      `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`,
    );
    await updateMetadata(storageRef, {
      cacheControl: 'public,max-age=31536000',
    });
  }

  protected async _verifyStudyDatabase() {
    // Throw an error if the db does not exist
    if (!this.studyCollection) {
      throw new Error('Study database not initialized');
    }
  }

  protected async _getCurrentConfigHash() {
    await this.verifyStudyDatabase();
    const configHashDoc = doc(
      this.studyCollection,
      'configHash',
    );
    const configHashDocData = await getDoc(configHashDoc);
    return configHashDocData.exists() ? configHashDocData.data().configHash as string : null;
  }

  protected async _setCurrentConfigHash(configHash: string) {
    await this.verifyStudyDatabase();
    const configHashDoc = doc(
      this.studyCollection,
      'configHash',
    );
    await setDoc(configHashDoc, { configHash });
  }

  public async getAllSequenceAssignments(studyId: string) {
    const studyCollection = collection(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
    );
    const sequenceAssignmentDoc = doc(studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );

    const sequenceAssignments = await getDocs(sequenceAssignmentCollection);
    return sequenceAssignments.docs
      .map((d) => d.data())
      .map((data) => ({
        ...data,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : data.timestamp,
        createdTime: data.createdTime instanceof Timestamp ? data.createdTime.toMillis() : data.createdTime,
        completed: data.completed instanceof Timestamp ? data.completed.toMillis() : data.completed,
        autoTimedOutAt: data.autoTimedOutAt instanceof Timestamp ? data.autoTimedOutAt.toMillis() : data.autoTimedOutAt,
      } as SequenceAssignment))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  public async getSequenceAssignment(studyId: string, participantId: string) {
    const studyCollection = collection(this.firestore, `${this.collectionPrefix}${studyId}`);
    const sequenceAssignmentDoc = doc(studyCollection, 'sequenceAssignment');
    const assignment = doc(collection(sequenceAssignmentDoc, 'sequenceAssignment'), participantId);
    const snapshot = await getDoc(assignment);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return {
      ...data,
      timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : data.timestamp,
      createdTime: data.createdTime instanceof Timestamp ? data.createdTime.toMillis() : data.createdTime,
      completed: data.completed instanceof Timestamp ? data.completed.toMillis() : data.completed,
    } as SequenceAssignment;
  }

  // Set up realtime listener for sequence assignments
  _setupSequenceAssignmentListener(studyId: string, callback: (assignments: SequenceAssignment[]) => void) {
    const studyCollection = collection(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
    );
    const sequenceAssignmentDoc = doc(studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );

    return onSnapshot(sequenceAssignmentCollection, (snapshot) => {
      const assignments = snapshot.docs
        .map((d) => d.data())
        .map((data) => ({
          ...data,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : data.timestamp,
          createdTime: data.createdTime instanceof Timestamp ? data.createdTime.toMillis() : data.createdTime,
          completed: data.completed instanceof Timestamp ? data.completed.toMillis() : data.completed,
          autoTimedOutAt: data.autoTimedOutAt instanceof Timestamp ? data.autoTimedOutAt.toMillis() : data.autoTimedOutAt,
        } as SequenceAssignment))
        .sort((a, b) => a.timestamp - b.timestamp);

      callback(assignments);
    });
  }

  protected async _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment, withServerTimestamp: boolean = false) {
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentDoc = doc(this.studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );
    const participantSequenceAssignmentDoc = doc(
      sequenceAssignmentCollection,
      participantId,
    );

    await runTransaction(this.firestore, async (transaction) => {
      const state = await this.readAllocation(transaction);
      const assignment = { ...sequenceAssignment };
      transaction.set(participantSequenceAssignmentDoc, {
        ...assignment,
        ...(withServerTimestamp ? { timestamp: serverTimestamp() } : {}),
        createdTime: serverTimestamp(),
      });
      state.assignments = state.assignments.filter((item) => item.participantId !== participantId).concat(assignment);
      state.nextCreationIndex += 1;
      this.writeAllocation(transaction, state, assignment.stage);
    });
  }

  protected async _updateSequenceAssignmentFields(participantId: string, updatedFields: Partial<SequenceAssignment>) {
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentDoc = doc(this.studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );
    const participantSequenceAssignmentDoc = doc(
      sequenceAssignmentCollection,
      participantId,
    );

    const firebaseUpdatedFields: Record<string, unknown> = { ...updatedFields };
    if (Object.hasOwn(updatedFields, 'conditions') && updatedFields.conditions === undefined) {
      firebaseUpdatedFields.conditions = deleteField();
    }
    if (Object.keys(firebaseUpdatedFields).length === 0) {
      return;
    }

    const changesAllocation = ['rejected', 'claimed', 'betweenSubjectsCombinationKey', 'sequenceKey', 'stage', 'timestamp']
      .some((field) => Object.hasOwn(updatedFields, field));
    if (changesAllocation) {
      await runTransaction(this.firestore, async (transaction) => {
        const state = await this.readAllocation(transaction);
        const assignment = state.assignments.find((item) => item.participantId === participantId);
        if (!assignment) throw new Error('Participant sequence assignment not found');
        const previousStage = assignment.stage;
        Object.assign(assignment, updatedFields);
        transaction.update(participantSequenceAssignmentDoc, firebaseUpdatedFields);
        this.writeAllocation(transaction, state, assignment.stage);
        if (previousStage !== assignment.stage) this.writeAllocation(transaction, state, previousStage);
      });
      return;
    }
    await updateDoc(participantSequenceAssignmentDoc, firebaseUpdatedFields);
  }

  protected async _getSequenceAssignment(participantId: string) {
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentDoc = doc(this.studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );
    const participantSequenceAssignmentDoc = doc(
      sequenceAssignmentCollection,
      participantId,
    );

    const participantSequenceAssignment = await getDoc(participantSequenceAssignmentDoc);
    if (!participantSequenceAssignment.exists()) {
      return null;
    }

    const data = participantSequenceAssignment.data();
    return {
      ...data,
      timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : data.timestamp,
      createdTime: data.createdTime instanceof Timestamp ? data.createdTime.toMillis() : data.createdTime,
      completed: data.completed instanceof Timestamp ? data.completed.toMillis() : data.completed,
      autoTimedOutAt: data.autoTimedOutAt instanceof Timestamp ? data.autoTimedOutAt.toMillis() : data.autoTimedOutAt,
    } as SequenceAssignment;
  }

  protected async _runWithLock<T>(lockKey: string, operation: () => Promise<T>) {
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const lockDocument = doc(this.studyCollection, 'locks');
    const token = uuidv4();
    const expiresInMs = 60_000;
    const acquireLock = async (attempt: number): Promise<void> => {
      const now = Date.now();
      try {
        await runTransaction(this.firestore, async (transaction) => {
          const snapshot = await transaction.get(lockDocument);
          const existingLock = snapshot.data()?.[lockKey] as {
            token?: string;
            expiresAt?: number;
          } | undefined;
          if (existingLock?.expiresAt && existingLock.expiresAt > now) {
            throw new Error('Study lock is held');
          }

          transaction.set(lockDocument, {
            [lockKey]: { token, expiresAt: now + expiresInMs },
          }, { merge: true });
        });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'Study lock is held') {
          throw error;
        }
        if (attempt >= 299) {
          throw new Error('Timed out while waiting for a study update to finish');
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 100);
        });
        await acquireLock(attempt + 1);
      }
    };

    await acquireLock(0);

    let lockRefreshError: unknown;
    const refreshLock = async () => {
      const now = Date.now();
      await runTransaction(this.firestore, async (transaction) => {
        const snapshot = await transaction.get(lockDocument);
        const existingLock = snapshot.data()?.[lockKey] as { token?: string } | undefined;
        if (existingLock?.token !== token) {
          throw new Error('Study update lock was lost');
        }
        transaction.update(lockDocument, { [lockKey]: { token, expiresAt: now + expiresInMs } });
      });
    };
    const refreshTimer = setInterval(() => {
      refreshLock().catch((error) => {
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
      await runTransaction(this.firestore, async (transaction) => {
        const snapshot = await transaction.get(lockDocument);
        const existingLock = snapshot.data()?.[lockKey] as { token?: string } | undefined;
        if (existingLock?.token === token) {
          transaction.update(lockDocument, new FieldPath(lockKey), deleteField());
        }
      }).catch((error) => {
        console.warn('Failed to release study update lock:', error);
      });
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

    const sequenceAssignmentDoc = doc(this.studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );
    const participantSequenceAssignmentDoc = doc(
      sequenceAssignmentCollection,
      this.currentParticipantId,
    );
    await runTransaction(this.firestore, async (transaction) => {
      const assignment = await transaction.get(participantSequenceAssignmentDoc);
      if (assignment.data()?.rejected) throw new Error('This participant has been timed out or rejected');
      transaction.update(participantSequenceAssignmentDoc, { completed: serverTimestamp() });
    });
  }

  protected async _rejectParticipantRealtime(participantId: string, onlyIncomplete = false) {
    return this.rejectAssignment(participantId, onlyIncomplete);
  }

  private async rejectAssignment(participantId: string, onlyIncomplete: boolean, failedInitialization?: { creationIndex: number; reservationToken: string }) {
    if (!this.studyId) throw new Error('Study ID is not set');
    return runTransaction(this.firestore, async (transaction) => {
      const state = await this.readAllocation(transaction);
      const assignment = state.assignments.find((item) => item.participantId === participantId);
      if (!assignment) throw new Error('Failed to retrieve sequence assignment for current participant');
      const current = await transaction.get(this.assignmentReference(participantId));
      const currentAssignment = current.data() as SequenceAssignment;
      if (failedInitialization) {
        const { initialization } = currentAssignment;
        if (currentAssignment.creationIndex === undefined || currentAssignment.creationIndex + 1 !== failedInitialization.creationIndex
          || !initialization || initialization.complete
          || !initialization.pending.includes(failedInitialization.reservationToken)) return false;
        const pending = initialization.pending.filter((token) => token !== failedInitialization.reservationToken);
        if (pending.length) {
          transaction.update(this.assignmentReference(participantId), { initialization: { pending, complete: false } });
          return false;
        }
      }
      if (onlyIncomplete && (currentAssignment.completed !== null || currentAssignment.autoTimedOutAt !== undefined)) return false;
      if (assignment.rejected) return true;
      const source = assignment.claimedParticipantId
        ? state.assignments.find((item) => item.participantId === assignment.claimedParticipantId)
        : state.assignments.find((item) => item.claimed && item.timestamp === assignment.timestamp);
      if (source) {
        state.hasAllocator = true;
        assignment.reusableSequenceIndex = state.allocator.nextSequenceIndex;
        state.allocator.nextSequenceIndex += 1;
        source.claimed = false;
        // A timed-out source stays timed out rather than becoming rejected.
        if (source.autoTimedOutAt === undefined) source.rejected = true;
        transaction.update(this.assignmentReference(source.participantId), source.autoTimedOutAt === undefined
          ? { claimed: false, rejected: true }
          : { claimed: false });
      }
      assignment.rejected = true;
      assignment.timestamp = Date.now();
      transaction.update(this.assignmentReference(participantId), { rejected: true, timestamp: assignment.timestamp, ...(assignment.reusableSequenceIndex === undefined ? {} : { reusableSequenceIndex: assignment.reusableSequenceIndex }) });
      this.writeAllocation(transaction, state, assignment.stage);
      return true;
    });
  }

  protected async _undoRejectParticipantRealtime(participantId: string) {
    if (!this.studyId) throw new Error('Study ID is not set');
    await runTransaction(this.firestore, async (transaction) => {
      const state = await this.readAllocation(transaction);
      const assignment = state.assignments.find((item) => item.participantId === participantId);
      if (!assignment) throw new Error('Failed to retrieve sequence assignment for current participant');
      if (!assignment.rejected) return;
      if (assignment.claimed) throw new Error('Cannot undo rejection after the participant slot has been reassigned');
      const source = state.assignments.find((item) => item.participantId === assignment.claimedParticipantId);
      if (source?.claimed) throw new Error('Cannot restore a participant whose original slot has been reassigned');
      if (source) {
        source.claimed = true;
        transaction.update(this.assignmentReference(source.participantId), { claimed: true });
        assignment.timestamp = source.timestamp;
      }
      assignment.rejected = false;
      if (assignment.reusableSequenceIndex !== undefined) {
        state.allocator.availableSequenceIndexes = [...new Set([...(state.allocator.availableSequenceIndexes || []), assignment.reusableSequenceIndex])].sort((a, b) => a - b);
        delete assignment.reusableSequenceIndex;
      }
      transaction.update(this.assignmentReference(participantId), { rejected: false, timestamp: assignment.timestamp, reusableSequenceIndex: deleteField() });
      this.writeAllocation(transaction, state, assignment.stage);
    });
  }

  protected async _claimSequenceAssignment(participantId: string) {
    await this.verifyStudyDatabase();
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentDoc = doc(this.studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );
    const participantSequenceAssignmentDoc = doc(
      sequenceAssignmentCollection,
      participantId,
    );

    await runTransaction(this.firestore, async (transaction) => {
      const state = await this.readAllocation(transaction);
      transaction.update(participantSequenceAssignmentDoc, { claimed: true });
      transaction.set(doc(this.studyCollection, 'allocation'), {
        revision: state.revision + 1, nextCreationIndex: state.nextCreationIndex,
      });
    });
  }

  protected async _getServerTimeMs(): Promise<number> {
    await this.verifyStudyDatabase();
    // Firestore has no clock to query, so stamp a document with the server's
    // time and read the committed value back.
    const serverTimeDocument = doc(this.studyCollection, 'serverTime');
    await setDoc(serverTimeDocument, { readAt: serverTimestamp() }, { merge: true });
    const snapshot = await getDoc(serverTimeDocument);
    const readAt = snapshot.data()?.readAt;
    if (!(readAt instanceof Timestamp)) {
      throw new Error('Failed to read the server clock');
    }
    return readAt.toMillis();
  }

  protected async _markSequenceAssignmentTimedOut(participantId: string, timedOutAt: number, deadline?: number): Promise<boolean> {
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    // The timeout releases the slot, so it shares the allocation transaction that
    // keeps the stage counts in step with the assignments.
    return await runTransaction(this.firestore, async (transaction) => {
      const state = await this.readAllocation(transaction);
      const assignmentSnapshot = await transaction.get(this.assignmentReference(participantId));
      if (!assignmentSnapshot.exists()) {
        throw new Error(`Sequence assignment for participant ${participantId} not found`);
      }
      const assignment = assignmentSnapshot.data() as SequenceAssignment;
      const storedCreatedTime = assignmentSnapshot.data()!.createdTime;
      const createdTime = storedCreatedTime instanceof Timestamp ? storedCreatedTime.toMillis() : storedCreatedTime;
      if (
        (deadline !== undefined && (!Number.isFinite(createdTime) || createdTime > deadline))
        || assignment.completed !== null
        || assignment.rejected
        || assignment.autoTimedOutAt !== undefined
      ) {
        return false;
      }
      const stateAssignment = state.assignments.find((item) => item.participantId === participantId);
      if (stateAssignment) stateAssignment.autoTimedOutAt = timedOutAt;
      transaction.update(this.assignmentReference(participantId), { autoTimedOutAt: serverTimestamp() });
      this.writeAllocation(transaction, state, assignment.stage);
      return true;
    });
  }

  async initializeAnonymousAuth() {
    const auth = getAuth();
    await auth.authStateReady();

    if (auth.currentUser) {
      return true;
    }

    try {
      await signInAnonymously(auth);
      return !!auth.currentUser;
    } catch (error) {
      const errorMessage = 'Firebase anonymous sign-in failed. Please ensure Anonymous Authentication is enabled in your Firebase Console.';
      console.error(errorMessage, error);
      return false;
    }
  }

  async checkAuthReadiness() {
    const isReady = await this.initializeAnonymousAuth();
    if (!isReady) {
      this.connected = false;
      throw new Error('FirebaseAuthError: Login failed with firebase');
    }
    this.connected = true;
  }

  async initializeStudyDb(studyId: string) {
    try {
      // Create or retrieve database for study
      this.studyCollection = collection(
        this.firestore,
        `${this.collectionPrefix}${studyId}`,
      );
      this.studyId = studyId;
    } catch {
      console.warn('Failed to connect to Firebase.');
    }
  }

  async connect() {
    try {
      await enableNetwork(this.firestore);
      this.connected = await this.initializeAnonymousAuth();
    } catch {
      this.connected = false;
      console.warn('Failed to connect to Firebase');
    }
  }

  async getStorageDisconnected(studyId: string) {
    const storageDoc = await getDoc(doc(this.firestore, `${this.collectionPrefix}${studyId}`, 'storage'));
    if (!storageDoc.exists()) return false;
    const { disconnected } = storageDoc.data();
    if (typeof disconnected !== 'boolean') throw new Error('Invalid storage mode');
    return disconnected;
  }

  protected async _setStorageDisconnected(studyId: string, disconnected: boolean) {
    await setDoc(doc(this.firestore, `${this.collectionPrefix}${studyId}`, 'storage'), { disconnected }, { merge: true });
  }

  protected async getAuthenticatedUser() {
    const user = getAuth().currentUser;
    return user ? { email: user.email, uid: user.uid } : null;
  }

  async getModes(studyId: string) {
    const revisitModesDoc = doc(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
      'modes',
    );
    const revisitModesData = await getDoc(revisitModesDoc);

    if (revisitModesData.exists()) {
      const modes = revisitModesData.data() as RuntimeStudySettings;
      const needsUpdate = 'studyNavigatorEnabled' in modes || 'analyticsInterfacePubliclyAccessible' in modes;

      if (needsUpdate) {
        const cleanedModes = cleanupModes(modes);
        await setDoc(revisitModesDoc, cleanedModes);
        return cleanedModes;
      }

      return modes;
    }

    // Else set to default values
    const defaultModes = {
      dataCollectionEnabled: true,
      developmentModeEnabled: true,
      dataSharingEnabled: true,
    };
    await setDoc(revisitModesDoc, defaultModes);
    return defaultModes;
  }

  protected async _setMode(studyId: string, mode: REVISIT_MODE, value: boolean) {
    const revisitModesDoc = doc(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
      'modes',
    );

    return await setDoc(revisitModesDoc, { [mode]: value }, { merge: true });
  }

  private async updateModesAtomically(studyId: string, update: (modes: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>, configHash?: string) {
    const studyCollection = collection(this.firestore, `${this.collectionPrefix}${studyId}`);
    const reference = doc(studyCollection, 'modes');
    await runTransaction(this.firestore, async (transaction) => {
      const state = await this.readAllocation(transaction, studyCollection);
      const current = (await transaction.get(reference)).data() || {
        dataCollectionEnabled: true, developmentModeEnabled: true, dataSharingEnabled: true,
      };
      const next = await update(current);
      const stageData = next.stage as StageData | undefined;
      const previous = current.stage as StageData | undefined;
      const stageStates = stageData ? await Promise.all(stageData.allStages.map((stage) => (
        transaction.get(this.stageAllocationReference(stage.stageName, studyCollection))
      ))) : [];
      previous?.allStages.forEach((stage) => {
        if (state.assignments.some((assignment) => assignment.stage === stage.stageName)
          && !stageData?.allStages.some((candidate) => candidate.stageName === stage.stageName)) {
          throw new Error('A stage with assignments cannot be removed');
        }
      });
      stageData?.allStages.forEach((stage, index) => {
        validateStageParticipantLimits(stage, state.assignments, previous?.allStages.find((item) => item.stageName === stage.stageName));
        if (state.assignments.some((assignment) => assignment.stage === stage.stageName)) {
          const knownKeys = previous?.allStages.find((item) => item.stageName === stage.stageName)?.conditionKeys || [];
          assertAppendOnlyConditions([...knownKeys, ...(stageStates[index].data()?.conditionKeys || [])], stage.conditionKeys || []);
        }
      });
      transaction.set(reference, next, { merge: true });
      if (configHash !== undefined) transaction.set(doc(studyCollection, 'configHash'), { configHash });
    });
  }

  protected override async activateConfig(configHash: string, keys: string[]) {
    await this.updateModesAtomically(this.studyId!, (modes) => {
      const data = modes.stage as StageData;
      return { ...modes, stage: applyStageUpdates(data, data.currentStage.stageName, { conditionKeys: keys }) };
    }, configHash);
  }

  protected override async changeStagePolicy(studyId: string, stageName: string, update: (stage: StageInfo) => StageUpdates | Promise<StageUpdates>) {
    await this.updateModesAtomically(studyId, async (modes) => {
      const data = modes.stage as StageData | undefined;
      const stage = data?.allStages.find((item) => item.stageName === stageName);
      if (!stage || !data) throw new Error(`Stage ${stageName} not found`);
      return { ...modes, stage: applyStageUpdates(data, stageName, await update(stage)) };
    });
  }

  protected override async updateStageUnlocked(studyId: string, stageName: string, updates: StageUpdates) {
    await this.changeStagePolicy(studyId, stageName, () => updates);
  }

  override async setCurrentStage(studyId: string, stageName: string, color = DISTINCT_COLOR_PALETTE[0], maxParticipants?: number) {
    await this.updateModesAtomically(studyId, (modes) => {
      const stage = modes.stage as StageData | undefined;
      const allStages = stage?.allStages || [{ stageName: 'DEFAULT', color: DISTINCT_COLOR_PALETTE[0] }];
      return {
        ...modes,
        stage: {
          currentStage: { stageName, color },
          allStages: allStages.some((item) => item.stageName === stageName) ? allStages : [
            ...allStages, { stageName, color, ...(maxParticipants === undefined ? {} : { maxParticipants }) },
          ],
        },
      };
    });
  }

  protected async _setModesDocument(studyId: string, modesDocument: Record<string, unknown>): Promise<void> {
    await this.updateModesAtomically(studyId, (current) => ({ ...current, ...modesDocument }));
  }

  protected async _updateModesFields(studyId: string, fields: Partial<RuntimeStudySettings>): Promise<void> {
    // Only the given fields change, so a concurrent stage or mode update is not
    // overwritten from a stale copy. The stage transaction also validates any
    // stage change against the current assignments.
    const fieldUpdates = Object.fromEntries(
      Object.entries(fields).map(([field, value]) => [field, value === undefined ? deleteField() : value]),
    );
    await this.updateModesAtomically(studyId, (current) => ({ ...current, ...fieldUpdates }));
  }

  async getStudyHiddenFromLandingPage(studyId: string): Promise<boolean> {
    const visibility = await getDoc(doc(this.firestore, `${this.collectionPrefix}${studyId}`, 'hideStudyFromLandingPage'));
    return visibility.data()?.hidden === true;
  }

  async setStudyHiddenFromLandingPage(studyId: string, hidden: boolean): Promise<void> {
    await setDoc(doc(this.firestore, `${this.collectionPrefix}${studyId}`, 'hideStudyFromLandingPage'), { hidden });
  }

  protected async _getAudioUrl(
    task: string,
    participantId: string,
  ): Promise<string | null> {
    const storage = getStorage();
    const audioRef = ref(storage, `${this.collectionPrefix}${this.studyId}/audio/${participantId}_${task}`);

    try {
      return await getDownloadURL(audioRef);
    } catch {
      console.warn(`Audio for task ${task} and participant ${participantId} not found.`);
      return null;
    }
  }

  protected async _getScreenRecordingUrl(
    task: string,
    participantId: string,
  ): Promise<string | null> {
    const storage = getStorage();
    const screenRecordingRef = ref(storage, `${this.collectionPrefix}${this.studyId}/screenRecording/${participantId}_${task}`);

    try {
      return await getDownloadURL(screenRecordingRef);
    } catch {
      console.warn(`Screen recording for task ${task} and participant ${participantId} not found.`);
      return null;
    }
  }

  protected async _getWebcamRecordingUrl(
    task: string,
    participantId: string,
  ): Promise<string | null> {
    const storage = getStorage();
    const webcamRecordingRef = ref(storage, `${this.collectionPrefix}${this.studyId}/webcamRecording/${participantId}_${task}`);

    try {
      return await getDownloadURL(webcamRecordingRef);
    } catch {
      console.warn(`Webcam recording for task ${task} and participant ${participantId} not found.`);
      return null;
    }
  }

  protected async _getTranscriptUrl(
    task: string,
    participantId: string,
  ): Promise<string | null> {
    const storage = getStorage();
    const transcriptRef = ref(storage, `${this.collectionPrefix}${this.studyId}/audio/${participantId}_${task}.wav_transcription.txt`);

    try {
      return await getDownloadURL(transcriptRef);
    } catch {
      console.warn(`Transcript for task ${task} and participant ${participantId} not found.`);
      return null;
    }
  }

  protected async _testingReset() {
    throw new Error('Testing reset not implemented for FirebaseStorageEngine');
  }

  async getSnapshots(studyId: string) {
    try {
      const snapshotsDoc = doc(this.firestore, `${this.collectionPrefix}${studyId}`, 'snapshots');
      const snapshotsData = await getDoc(snapshotsDoc);

      if (snapshotsData.exists()) {
        return snapshotsData.data() as SnapshotDocContent;
      }
      return {};
    } catch (error) {
      console.error('Error listing collections with prefix:', error);
      throw error;
    }
  }

  protected async _directoryExists(directoryPath: string) {
    try {
      const directoryRef = ref(this.storage, directoryPath);
      const directorySnapshot = await listAll(directoryRef);
      return directorySnapshot.items.length > 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === 'storage/object-not-found') {
        return false;
      }
      console.error('Error checking if directory exists:', error);
      throw error;
    }
  }

  protected async _copyDirectory(sourceDir: string, targetDir: string) {
    try {
      const sourceDirRef = ref(this.storage, sourceDir);
      const sourceDirSnapshot = await listAll(sourceDirRef);

      const copyPromises = sourceDirSnapshot.items.map((fileRef) => {
        const sourceFilePath = fileRef.fullPath;
        const targetFilePath = sourceFilePath.replace(sourceDir, targetDir);
        return this._copyFile(sourceFilePath, targetFilePath);
      });
      await Promise.all(copyPromises);
    } catch (error) {
      console.error('Error copying file:', error);
    }
  }

  protected async _deleteDirectory(directoryPath: string) {
    try {
      const directoryRef = ref(this.storage, directoryPath);
      const directorySnapshot = await listAll(directoryRef);

      const deletePromises = directorySnapshot.items.map((fileRef) => deleteObject(fileRef));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting files in directory:', error);
    }
  }

  protected async _copyRealtimeData(sourceCollectionName: string, targetCollectionName: string) {
    const source = collection(this.firestore, sourceCollectionName);
    const target = collection(this.firestore, targetCollectionName);
    await runTransaction(this.firestore, async (transaction) => {
      const sourceState = await this.readAllocation(transaction, source);
      const targetState = await this.readAllocation(transaction, target);
      const assignments = new Map(targetState.assignments.map((assignment) => [assignment.participantId, assignment]));
      sourceState.assignments.forEach((assignment) => assignments.set(assignment.participantId, assignment));
      targetState.assignments = [...assignments.values()];
      const rebuilt = rebuildSequenceAllocator(targetState.assignments);
      const occupied = new Set(targetState.assignments.filter((assignment) => !assignment.claimed).map((assignment) => (assignment.rejected ? assignment.reusableSequenceIndex ?? assignment.sequenceIndex : assignment.sequenceIndex)));
      targetState.allocator = {
        nextSequenceIndex: Math.max(sourceState.allocator.nextSequenceIndex, targetState.allocator.nextSequenceIndex, rebuilt.nextSequenceIndex),
        nextCreationIndex: Math.max(sourceState.allocator.nextCreationIndex, targetState.allocator.nextCreationIndex, rebuilt.nextCreationIndex),
        ...(sourceState.allocator.availableSequenceIndexes || targetState.allocator.availableSequenceIndexes ? {
          availableSequenceIndexes: [...new Set([...(sourceState.allocator.availableSequenceIndexes || []), ...(targetState.allocator.availableSequenceIndexes || [])])].filter((index) => !occupied.has(index)).sort((a, b) => a - b),
        } : {}),
      };
      targetState.hasAllocator = true;
      targetState.nextCreationIndex = targetState.allocator.nextCreationIndex;
      const targetAssignments = collection(doc(target, 'sequenceAssignment'), 'sequenceAssignment');
      transaction.set(doc(target, 'sequenceAssignment'), {});
      sourceState.assignments.forEach((assignment) => {
        transaction.set(doc(targetAssignments, assignment.participantId), assignment);
      });
      [...new Set(targetState.assignments.map((assignment) => assignment.stage))].forEach((stage) => {
        this.writeAllocation(transaction, targetState, stage, undefined, target);
      });
    });
  }

  protected async _deleteRealtimeData(sourceCollectionName: string) {
    const source = collection(this.firestore, sourceCollectionName);
    await runTransaction(this.firestore, async (transaction) => {
      const state = await this.readAllocation(transaction, source);
      const stages = [...new Set(state.assignments.map((assignment) => assignment.stage))];
      const assignments = collection(doc(source, 'sequenceAssignment'), 'sequenceAssignment');
      state.assignments.forEach((assignment) => transaction.delete(doc(assignments, assignment.participantId)));
      transaction.delete(doc(source, 'sequenceAssignment'));
      state.assignments = [];
      state.nextCreationIndex = 0;
      state.allocator = { nextCreationIndex: 0, nextSequenceIndex: 0 };
      stages.forEach((stage) => this.writeAllocation(transaction, state, stage, undefined, source));
      transaction.delete(doc(source, 'sequenceAssignmentAllocator'));
      transaction.delete(doc(source, 'configHash'));
    });
  }

  // Function to add collection name to metadata
  protected async _addDirectoryNameToSnapshots(
    directoryName: string,
    studyId: string,
    participantCounts?: SnapshotParticipantCounts,
  ) {
    try {
      const snapshotDoc = doc(this.firestore, `${this.collectionPrefix}${studyId}`, 'snapshots');
      const snapshotMetadata = participantCounts
        ? { name: directoryName, participantCounts }
        : { name: directoryName };
      await setDoc(
        snapshotDoc,
        { [directoryName]: snapshotMetadata } as SnapshotDocContent,
        { merge: true },
      );
    } catch (error) {
      console.error('Error adding collection to metadata:', error);
      throw error;
    }
  }

  protected async _removeDirectoryNameFromSnapshots(directoryName: string, studyId: string) {
    try {
      const snapshotDoc = doc(this.firestore, `${this.collectionPrefix}${studyId}`, 'snapshots');
      const snapshotData = await getDoc(snapshotDoc);

      if (snapshotData.exists()) {
        const metadata = snapshotData.data();
        if (metadata[directoryName]) {
          delete metadata[directoryName];
          await setDoc(snapshotDoc, metadata);
        } else {
          console.warn(`${directoryName} does not exist in metadata.`);
        }
      } else {
        console.warn('No metadata found.');
      }
    } catch (error) {
      console.error('Error removing collection from metadata:', error);
      throw error;
    }
  }

  protected async _changeDirectoryNameInSnapshots(oldName: string, newName: string, studyId: string) {
    const snapshotDoc = doc(this.firestore, `${this.collectionPrefix}${studyId}`, 'snapshots');
    const snapshotData = await getDoc(snapshotDoc);
    const existingMetadata = snapshotData.exists()
      ? (snapshotData.data() as SnapshotDocContent)[oldName] ?? { name: oldName }
      : { name: oldName };
    await setDoc(
      snapshotDoc,
      { [oldName]: { ...existingMetadata, name: newName } },
      { merge: true },
    );
  }

  protected async _updateSnapshotParticipantCounts(
    snapshotName: string,
    studyId: string,
    participantCounts: SnapshotParticipantCounts,
  ) {
    const snapshotDoc = doc(this.firestore, `${this.collectionPrefix}${studyId}`, 'snapshots');
    const snapshotData = await getDoc(snapshotDoc);
    const existingMetadata = snapshotData.exists()
      ? (snapshotData.data() as SnapshotDocContent)[snapshotName]
      : undefined;

    if (!existingMetadata) {
      throw new Error(`Snapshot with name ${snapshotName} does not exist`);
    }

    await setDoc(
      snapshotDoc,
      { [snapshotName]: { ...existingMetadata, participantCounts } },
      { merge: true },
    );
  }

  private async _copyFile(sourceFilePath: string, targetFilePath: string) {
    try {
      const sourceFileRef = ref(this.storage, sourceFilePath);
      const targetFileRef = ref(this.storage, targetFilePath);

      const sourceFileURL = await getDownloadURL(sourceFileRef);
      const response = await fetch(sourceFileURL);
      const blob = await response.blob();

      await uploadBytes(targetFileRef, blob);
    } catch (error) {
      console.error('Error copying file:', error);
    }
  }

  // Gets data from the user-management collection based on the inputted string
  async getUserManagementData(key: 'authentication'): Promise<{ isEnabled: boolean } | undefined>;

  async getUserManagementData(key: 'adminUsers'): Promise<{ adminUsersList: StoredUser[] } | undefined>;

  async getUserManagementData(
    key: 'authentication' | 'adminUsers',
  ): Promise<{ isEnabled: boolean } | { adminUsersList: StoredUser[] } | undefined> {
    if (Object.keys(this.userManagementData).length === 0) {
      // Get the user-management collection in Firestore
      const userManagementCollection = collection(
        this.firestore,
        'user-management',
      );
      // Grabs all user-management data and returns data based on key
      const querySnapshot = await getDocs(userManagementCollection);
      // Converts querySnapshot data to Object
      const docsObject = Object.fromEntries(
        querySnapshot.docs.map((queryDoc) => [queryDoc.id, queryDoc.data()]),
      );
      this.userManagementData = docsObject as UserManagementData;
    }
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

  protected async _updateAdminUsersList(adminUsers: { adminUsersList: StoredUser[] }) {
    await setDoc(
      doc(this.firestore, 'user-management', 'adminUsers'),
      {
        adminUsersList: adminUsers.adminUsersList,
      },
    );
  }

  async changeAuth(bool: boolean) {
    await setDoc(doc(this.firestore, 'user-management', 'authentication'), {
      isEnabled: bool,
    });
  }

  async addAdminUser(user: StoredUser) {
    const adminUsers = await this.getUserManagementData('adminUsers');
    if (adminUsers?.adminUsersList) {
      const adminList = adminUsers.adminUsersList;
      const isInList = adminList.find(
        (storedUser: StoredUser) => storedUser.email === user.email,
      );
      if (!isInList) {
        adminList.push({ email: user.email, uid: user.uid });
        await setDoc(doc(this.firestore, 'user-management', 'adminUsers'), {
          adminUsersList: adminList,
        });
      }
    } else {
      await setDoc(doc(this.firestore, 'user-management', 'adminUsers'), {
        adminUsersList: [{ email: user.email, uid: user.uid }],
      });
    }
  }

  async removeAdminUser(email: string) {
    const adminUsers = await this.getUserManagementData('adminUsers');
    if (adminUsers?.adminUsersList && adminUsers.adminUsersList.length > 1) {
      if (
        adminUsers.adminUsersList.find(
          (storedUser: StoredUser) => storedUser.email === email,
        )
      ) {
        adminUsers.adminUsersList = adminUsers?.adminUsersList.filter(
          (storedUser: StoredUser) => storedUser.email !== email,
        );
        await setDoc(doc(this.firestore, 'user-management', 'adminUsers'), {
          adminUsersList: adminUsers?.adminUsersList,
        });
      }
    }
  }

  async login() {
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    signInWithPopup(auth, provider, browserPopupRedirectResolver);

    return {
      email: auth.currentUser?.email || null,
      uid: auth.currentUser?.uid || null,
    };
  }

  unsubscribe(callback: (cloudUser: StoredUser | null) => Promise<void>) {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (cloudUser) => await callback(cloudUser));
    return () => unsubscribe();
  }

  async logout() {
    const auth = getAuth();
    await signOut(auth);
  }

  async getTranscription(taskName: string, participantId: string) {
    return await this._getFromStorage(`audio/${participantId}_${taskName}.wav`, 'transcription.txt');
  }

  async getEditedTranscript(participantId: string, authEmail: string, task: string) {
    const transcript = await this._getFromStorage(`audio/transcriptAndTags/${authEmail}/${participantId}/${task}`, 'editedText');

    if (Array.isArray(transcript)) {
      const tags = await this.getTags('text');

      if (tags) {
        // loop over the transcript and merge the tags
        transcript.forEach((line) => {
          line.selectedTags = line.selectedTags.map((tag) => {
            const matchingTag = tags.find((t) => t.id === tag.id);
            return matchingTag!;
          });
        });
      }

      return transcript as EditedText[];
    }

    this.saveEditedTranscript(participantId, authEmail, task, []);
    return [];
  }

  async saveEditedTranscript(participantId: string, authEmail: string, task: string, editedText: EditedText[]) {
    const taglessTranscript = editedText.map((line) => ({ ...line, selectedTags: line.selectedTags.filter((tag) => tag !== undefined) })) as TaglessEditedText[];

    return this._pushToStorage(`audio/transcriptAndTags/${authEmail}/${participantId}/${task}`, 'editedText', taglessTranscript);
  }

  private async getSequenceAllocatorSeed(sequenceAssignments: CollectionReference<DocumentData>): Promise<SequenceAllocator> {
    const [totalAssignments, claimedAssignments] = await Promise.all([
      getCountFromServer(sequenceAssignments),
      getCountFromServer(query(sequenceAssignments, where('claimed', '==', true))),
    ]);
    return {
      nextSequenceIndex: totalAssignments.data().count - claimedAssignments.data().count,
      nextCreationIndex: totalAssignments.data().count,
    };
  }

  private async getLegacySequenceIndex(sequenceAssignments: CollectionReference<DocumentData>, timestamp: number | Timestamp) {
    const milliseconds = timestamp instanceof Timestamp ? timestamp.toMillis() : timestamp;
    // Legacy records contain both numeric milliseconds and Firestore timestamps.
    const counts = await Promise.all([milliseconds, Timestamp.fromMillis(milliseconds)].map((threshold) => (
      getCountFromServer(query(
        sequenceAssignments,
        where('rejected', '==', false),
        where('timestamp', '<', threshold),
      ))
    )));
    return counts.reduce((total, count) => total + count.data().count, 0);
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
    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const sequenceAssignmentDoc = doc(this.studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );
    const participantSequenceAssignmentDoc = doc(sequenceAssignmentCollection, participantId);
    const allocatorDoc = doc(this.studyCollection, 'sequenceAssignmentAllocator');

    const [existingAssignmentSnapshot, existingAllocatorSnapshot] = await Promise.all([
      getDoc(participantSequenceAssignmentDoc),
      getDoc(allocatorDoc),
    ]);
    const existingAssignment = existingAssignmentSnapshot.exists()
      ? existingAssignmentSnapshot.data() as SequenceAssignment
      : null;
    if (existingAssignment) {
      if (
        existingAssignment.sequenceIndex !== undefined
        && existingAssignment.creationIndex !== undefined
      ) {
        return {
          sequenceIndex: existingAssignment.sequenceIndex,
          creationIndex: existingAssignment.creationIndex,
        };
      }

      const [sequenceIndex, creationCount] = await Promise.all([
        this.getLegacySequenceIndex(sequenceAssignmentCollection, existingAssignment.timestamp),
        getCountFromServer(query(
          sequenceAssignmentCollection,
          where('createdTime', '<', existingAssignment.createdTime),
        )),
      ]);
      return {
        sequenceIndex,
        creationIndex: creationCount.data().count,
      };
    }

    const allocatorSeedPromise = existingAllocatorSnapshot.exists()
      ? Promise.resolve(existingAllocatorSnapshot.data() as SequenceAllocator)
      : this.getSequenceAllocatorSeed(sequenceAssignmentCollection);
    const [allocatorSeed, reusableSnapshots] = await Promise.all([
      allocatorSeedPromise,
      Promise.all([0, Timestamp.fromMillis(0)].map((threshold) => getDocs(query(
        sequenceAssignmentCollection,
        where('rejected', '==', true),
        where('claimed', '==', false),
        where('timestamp', '>=', threshold),
        orderBy('timestamp', 'asc'),
        limit(1),
      )))),
    ]);
    const reusableDocument = reusableSnapshots.flatMap((snapshot) => snapshot.docs).sort((a, b) => {
      const aTimestamp = a.data().timestamp;
      const bTimestamp = b.data().timestamp;
      return (aTimestamp instanceof Timestamp ? aTimestamp.toMillis() : aTimestamp)
        - (bTimestamp instanceof Timestamp ? bTimestamp.toMillis() : bTimestamp);
    })[0];
    const reusableData = reusableDocument?.data() as SequenceAssignment | undefined;
    let legacyReusableIndex: number | undefined;
    if (
      reusableData
      && reusableData.reusableSequenceIndex === undefined
      && reusableData.sequenceIndex === undefined
    ) {
      legacyReusableIndex = await this.getLegacySequenceIndex(
        sequenceAssignmentCollection,
        reusableData.timestamp,
      );
    }

    return runTransaction(this.firestore, async (transaction) => {
      const [currentAssignmentSnapshot, allocatorSnapshot, reusableAssignmentSnapshot] = await Promise.all([
        transaction.get(participantSequenceAssignmentDoc),
        transaction.get(allocatorDoc),
        reusableDocument ? transaction.get(doc(sequenceAssignmentCollection, reusableDocument.id)) : null,
      ]);

      if (currentAssignmentSnapshot.exists()) {
        const currentAssignment = currentAssignmentSnapshot.data() as SequenceAssignment;
        if (
          currentAssignment.sequenceIndex === undefined
          || currentAssignment.creationIndex === undefined
        ) {
          throw new Error('Existing sequence assignment is missing allocator metadata');
        }
        return {
          sequenceIndex: currentAssignment.sequenceIndex,
          creationIndex: currentAssignment.creationIndex,
        };
      }

      const allocator = allocatorSnapshot.exists()
        ? allocatorSnapshot.data() as typeof allocatorSeed
        : allocatorSeed;
      const reusableAssignment = reusableAssignmentSnapshot?.exists()
        ? reusableAssignmentSnapshot.data() as SequenceAssignment
        : undefined;
      const canReuse = reusableAssignment?.rejected && !reusableAssignment.claimed;
      if (reusableDocument && !canReuse) {
        // Another start claimed our candidate; select the next vacancy before reserving a fresh slot.
        return null;
      }
      const sequenceIndex = canReuse
        ? reusableAssignment.reusableSequenceIndex
          ?? reusableAssignment.sequenceIndex
          ?? legacyReusableIndex
        : allocator.availableSequenceIndexes?.[0] ?? allocator.nextSequenceIndex;
      if (sequenceIndex === undefined || sequenceIndex < 0) {
        throw new Error('Unable to determine sequence assignment index');
      }
      const creationIndex = allocator.nextCreationIndex;

      if (canReuse && reusableDocument) {
        transaction.update(doc(sequenceAssignmentCollection, reusableDocument.id), {
          claimed: true,
          sequenceIndex,
        });
      }
      transaction.set(participantSequenceAssignmentDoc, {
        ...sequenceAssignment,
        ...(canReuse && reusableDocument ? {
          timestamp: reusableAssignment.timestamp,
          claimedParticipantId: reusableDocument.id,
        } : { timestamp: serverTimestamp() }),
        createdTime: serverTimestamp(),
        sequenceIndex,
        creationIndex,
      });
      transaction.set(allocatorDoc, {
        ...allocator,
        ...(allocator.availableSequenceIndexes ? {
          availableSequenceIndexes: canReuse
            ? allocator.availableSequenceIndexes
            : allocator.availableSequenceIndexes.slice(1),
        } : {}),
        nextSequenceIndex: canReuse || allocator.availableSequenceIndexes?.length
          ? allocator.nextSequenceIndex
          : allocator.nextSequenceIndex + 1,
        nextCreationIndex: allocator.nextCreationIndex + 1,
      });

      return { sequenceIndex, creationIndex };
    });
  }

  protected override async hasStageAssignments(stage: string): Promise<boolean> {
    const assignments = collection(doc(this.studyCollection, 'sequenceAssignment'), 'sequenceAssignment');
    const result = await getCountFromServer(query(assignments, where('stage', '==', stage)));
    return result.data().count > 0;
  }

  protected override async getStageAllocation(stage: string, conditionKeys: string[] = []): Promise<StageAllocation> {
    const reference = this.stageAllocationReference(stage);
    const existing = await getDoc(reference);
    if (existing.exists()) return { rowCounts: {}, ...existing.data() } as StageAllocation;
    // These counts need not exclude auto-timeouts: every timeout updates its
    // stage's allocation document in the same transaction, creating it if
    // needed, so a stage without one has no timed-out assignments.
    const assignments = collection(doc(this.studyCollection, 'sequenceAssignment'), 'sequenceAssignment');
    const counts = await Promise.all([undefined, ...conditionKeys].map((key) => getCountFromServer(query(
      assignments,
      where('stage', '==', stage),
      where('rejected', '==', false),
      ...(key === undefined ? [] : [where('betweenSubjectsCombinationKey', '==', key)]),
    ))));
    const initial = {
      count: counts[0].data().count, combinationCounts: Object.fromEntries(conditionKeys.map((key, index) => [key, counts[index + 1].data().count])), rowCounts: {}, conditionKeys,
    };
    return runTransaction(this.firestore, async (transaction) => {
      const current = await transaction.get(reference);
      if (current.exists()) return { rowCounts: {}, ...current.data() } as StageAllocation;
      transaction.set(reference, initial);
      return initial;
    });
  }
}
