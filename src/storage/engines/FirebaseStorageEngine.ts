import { parse as hjsonParse } from 'hjson';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { initializeApp } from 'firebase/app';
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  listAll,
  FirebaseStorage,
  updateMetadata,
} from 'firebase/storage';
import {
  CollectionReference,
  DocumentData,
  Firestore,
  FieldPath,
  Transaction,
  Timestamp,
  collection,
  deleteField,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
  getDocsFromServer,
  initializeFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { ReCaptchaV3Provider, ReCaptchaEnterpriseProvider, initializeAppCheck } from '@firebase/app-check';
import {
  browserPopupRedirectResolver, getAuth, GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut,
} from '@firebase/auth';
import {
  CloudStorageEngine,
  REVISIT_MODE,
  StorageObjectType,
  StorageObject,
  UserManagementData,
  SequenceAssignment,
  SnapshotDocContent,
  StoredUser,
  cleanupModes,
  ModesAndStageData,
  StageInfo,
  StageUpdates,
  StageData,
  applyStageUpdates,
  StageCapacityExceededError,
  StageNoAvailableConditionsError,
  StageOnlyDisabledConditionsHaveCapacityError,
  getBetweenSubjectsCombinationKey,
  getConfigConditionKeys,
  getDesiredParticipantCountsByCombination,
  getLeastServedSequence,
  getStageParticipantCounts,
  isSequenceEnabledForStage,
  assertAppendOnlyConditions,
  validateStageParticipantLimits,
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
};

export class FirebaseStorageEngine extends CloudStorageEngine {
  protected override hasAtomicSequenceReservation = true;

  private assignmentReference(participantId: string) {
    return doc(collection(doc(this.studyCollection, 'sequenceAssignment'), 'sequenceAssignment'), participantId);
  }

  private stageAllocationReference(stage: string, studyCollection = this.studyCollection) {
    return doc(collection(doc(studyCollection, 'allocation'), 'stages'), encodeURIComponent(stage));
  }

  private async readAllocation(transaction: Transaction, studyCollection = this.studyCollection): Promise<AllocationState> {
    const revision = await transaction.get(doc(studyCollection, 'allocation'));
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
      nextCreationIndex: Math.max(revision.data()?.nextCreationIndex ?? 1, assignments.length + 1, ...assignments.map((assignment) => (assignment.creationIndex || 0) + 1)),
      assignments,
    };
  }

  private writeAllocation(transaction: Transaction, state: AllocationState, stage: string, conditionKeys?: string[], studyCollection = this.studyCollection) {
    transaction.set(doc(studyCollection, 'allocation'), {
      revision: state.revision + 1,
      nextCreationIndex: state.nextCreationIndex,
    });
    const counts: Record<string, number> = {};
    state.assignments.filter((assignment) => assignment.stage === stage && !assignment.rejected).forEach((assignment) => {
      const key = assignment.betweenSubjectsCombinationKey;
      if (key !== undefined) counts[key] = (counts[key] || 0) + 1;
    });
    transaction.set(this.stageAllocationReference(stage, studyCollection), {
      count: getStageParticipantCounts(state.assignments)[stage] || 0,
      combinationCounts: counts,
      ...(conditionKeys === undefined ? {} : { conditionKeys }),
    }, { mergeFields: ['count', 'combinationCounts', ...(conditionKeys === undefined ? [] : ['conditionKeys'])] });
  }

  protected override async _getSequence(
    conditions: string[] | undefined,
    bootstrapData: ModesAndStageData,
    config: StudyConfig,
    participantConfigHash: string,
  ) {
    if (!bootstrapData.modes.dataCollectionEnabled) {
      return super._getSequence(conditions, bootstrapData, config, participantConfigHash);
    }
    const participantId = this.currentParticipantId!;
    const sequences = bootstrapData.sequenceArray
      ?? await this.getSequenceArray(await this._getCurrentConfigHash() ? participantConfigHash : undefined);
    if (!sequences?.length) throw new Error('Latin square not initialized');
    const betweenSubjects = config.betweenSubjects || [];
    const conditionKeys = getConfigConditionKeys(config);
    const reservationToken = uuidv4();
    return runTransaction(this.firestore, async (transaction) => {
      const state = await this.readAllocation(transaction);
      const modesReference = doc(this.studyCollection, 'modes');
      const modes = (await transaction.get(modesReference)).data();
      if (!modes?.dataCollectionEnabled) throw new Error('Study settings changed while joining. Please reload.');
      const stageData = modes.stage as ModesAndStageData['stageData'];
      const stage = stageData.allStages.find((item) => item.stageName === stageData.currentStage.stageName)!;
      const ownAssignment = (await transaction.get(this.assignmentReference(participantId))).data() as SequenceAssignment | undefined;
      const existing = ownAssignment && !ownAssignment.rejected ? ownAssignment : undefined;
      if (existing) {
        const prefix = `${participantConfigHash}:`;
        const row = existing.sequenceKey?.startsWith(prefix)
          ? sequences[Number(existing.sequenceKey.slice(prefix.length))] : undefined;
        if (!row || !existing.creationIndex) throw new Error('The unfinished reservation uses a different study configuration. Please contact the study administrator.');
        if (existing.initialization && !existing.initialization.complete) {
          transaction.update(this.assignmentReference(participantId), {
            initialization: { pending: [...existing.initialization.pending, reservationToken], complete: false },
          });
        }
        return {
          currentRow: row, creationIndex: existing.creationIndex, stage: existing.stage, reservationToken,
        };
      }
      const stageState = (await transaction.get(this.stageAllocationReference(stage.stageName))).data();
      if (state.assignments.some((item) => item.stage === stage.stageName)) {
        assertAppendOnlyConditions([...new Set([...(stageState?.conditionKeys ?? []), ...(stage.conditionKeys ?? [])])], conditionKeys);
      }
      const active = state.assignments.filter((item) => item.stage === stage.stageName && !item.rejected);
      if (stage.maxParticipants !== undefined && active.length >= stage.maxParticipants) {
        throw new StageCapacityExceededError(stage.stageName);
      }
      const counts: Record<string, number> = {};
      const rowCounts = new Map<Sequence, number>(sequences.map((row) => [row, 0]));
      active.forEach((assignment) => {
        const key = assignment.betweenSubjectsCombinationKey;
        if (key !== undefined) counts[key] = (counts[key] || 0) + 1;
        const prefix = `${participantConfigHash}:`;
        if (assignment.sequenceKey?.startsWith(prefix)) {
          const row = sequences[Number(assignment.sequenceKey.slice(prefix.length))];
          if (row) rowCounts.set(row, rowCounts.get(row)! + 1);
        }
      });
      const enabled = sequences.filter((row) => isSequenceEnabledForStage(row, stage, betweenSubjects));
      if (!enabled.length) throw new StageNoAvailableConditionsError(stage.stageName);
      const targets = getDesiredParticipantCountsByCombination(stage, sequences, betweenSubjects);
      const hasCapacity = (row: Sequence) => {
        const key = getBetweenSubjectsCombinationKey(row.parameters, betweenSubjects);
        return !targets || (counts[key] || 0) < targets[key];
      };
      const eligible = enabled.filter(hasCapacity);
      if (!eligible.length) {
        if (sequences.some((row) => !isSequenceEnabledForStage(row, stage, betweenSubjects) && hasCapacity(row))) {
          throw new StageOnlyDisabledConditionsHaveCapacityError(stage.stageName);
        }
        throw new StageCapacityExceededError(stage.stageName);
      }
      const row = betweenSubjects.length
        ? getLeastServedSequence(eligible, counts, targets, betweenSubjects, active.length, rowCounts)
        : eligible.reduce((least, candidate) => (rowCounts.get(candidate)! < rowCounts.get(least)! ? candidate : least));
      const source = state.assignments.find((item) => item.rejected && !item.claimed && item.participantId !== participantId);
      const assignment: SequenceAssignment = {
        participantId,
        timestamp: source?.timestamp ?? Date.now(),
        createdTime: Date.now(),
        rejected: false,
        claimed: false,
        ...(source ? { claimedParticipantId: source.participantId } : {}),
        completed: null,
        total: 0,
        answered: [],
        isDynamic: false,
        stage: stage.stageName,
        ...(conditions ? { conditions } : {}),
        betweenSubjectsCombinationKey: getBetweenSubjectsCombinationKey(row.parameters, betweenSubjects),
        sequenceKey: `${participantConfigHash}:${sequences.indexOf(row)}`,
        creationIndex: state.nextCreationIndex,
        initialization: { pending: [reservationToken], complete: false },
      };
      if (source) transaction.update(this.assignmentReference(source.participantId), { claimed: true });
      transaction.set(this.assignmentReference(participantId), {
        ...assignment,
        createdTime: serverTimestamp(),
        ...(!source ? { timestamp: serverTimestamp() } : {}),
      });
      state.assignments = state.assignments.filter((item) => item.participantId !== participantId).concat(assignment);
      state.nextCreationIndex += 1;
      this.writeAllocation(transaction, state, stage.stageName, conditionKeys);
      transaction.set(modesReference, {
        stage: {
          ...stageData,
          allStages: stageData.allStages.map((item) => (
            item.stageName === stage.stageName ? { ...item, conditionKeys } : item
          )),
        },
      }, { merge: true });
      return {
        currentRow: row, creationIndex: assignment.creationIndex!, stage: stage.stageName, reservationToken,
      };
    });
  }

  protected override async confirmParticipantReservation(participant: ParticipantData, reservationToken?: string, fromCache = false) {
    return runTransaction(this.firestore, async (transaction) => {
      const reference = this.assignmentReference(participant.participantId);
      const assignment = (await transaction.get(reference)).data() as SequenceAssignment | undefined;
      if (!assignment?.initialization) return true;
      if (assignment.creationIndex !== participant.participantIndex) return false;
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

  protected async _getFromStorage<T extends StorageObjectType>(prefix: string, type: T, studyId?: string) {
    const storageRef = ref(
      this.storage,
      `${this.collectionPrefix}${studyId || this.studyId}/${prefix}_${type}`,
    );

    let storageObj: StorageObject<T> = {} as StorageObject<T>;
    try {
      const blob = await getBlob(storageRef);
      const fullProvStr = await blob.text();
      storageObj = JSON.parse(fullProvStr);
    } catch (error) {
      // A failed sequence read must not look absent and trigger replacement.
      if (type === 'sequenceArray' && (error as { code?: string } | null)?.code !== 'storage/object-not-found') throw error;
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
      const assignment = { ...sequenceAssignment, creationIndex: sequenceAssignment.creationIndex ?? state.nextCreationIndex };
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

    try {
      return await operation();
    } finally {
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
        if (currentAssignment.creationIndex !== failedInitialization.creationIndex
          || !initialization || initialization.complete
          || !initialization.pending.includes(failedInitialization.reservationToken)) return false;
        const pending = initialization.pending.filter((token) => token !== failedInitialization.reservationToken);
        if (pending.length) {
          transaction.update(this.assignmentReference(participantId), { initialization: { pending, complete: false } });
          return false;
        }
      }
      if (onlyIncomplete && currentAssignment.completed !== null) return false;
      if (assignment.rejected) return true;
      const source = assignment.claimedParticipantId
        ? state.assignments.find((item) => item.participantId === assignment.claimedParticipantId)
        : state.assignments.find((item) => item.claimed && item.timestamp === assignment.timestamp);
      if (source) {
        source.claimed = false;
        transaction.update(this.assignmentReference(source.participantId), { claimed: false, rejected: true });
      }
      assignment.rejected = true;
      assignment.timestamp = Date.now();
      transaction.update(this.assignmentReference(participantId), { rejected: true, timestamp: assignment.timestamp });
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
      transaction.update(this.assignmentReference(participantId), { rejected: false, timestamp: assignment.timestamp });
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
      const modes = revisitModesData.data() as Record<string, boolean>;
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

  private async updateModesAtomically(studyId: string, update: (modes: Record<string, unknown>) => Record<string, unknown>, configHash?: string) {
    const studyCollection = collection(this.firestore, `${this.collectionPrefix}${studyId}`);
    const reference = doc(studyCollection, 'modes');
    await runTransaction(this.firestore, async (transaction) => {
      const state = await this.readAllocation(transaction, studyCollection);
      const current = (await transaction.get(reference)).data() || {
        dataCollectionEnabled: true, developmentModeEnabled: true, dataSharingEnabled: true,
      };
      const next = update(current);
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

  protected override async changeStagePolicy(studyId: string, stageName: string, update: (stage: StageInfo) => StageUpdates) {
    await this.updateModesAtomically(studyId, (modes) => {
      const data = modes.stage as StageData | undefined;
      const stage = data?.allStages.find((item) => item.stageName === stageName);
      if (!stage || !data) throw new Error(`Stage ${stageName} not found`);
      return { ...modes, stage: applyStageUpdates(data, stageName, update(stage)) };
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
      targetState.nextCreationIndex = Math.max(targetState.nextCreationIndex, sourceState.nextCreationIndex);
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
      stages.forEach((stage) => this.writeAllocation(transaction, state, stage, undefined, source));
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
}
