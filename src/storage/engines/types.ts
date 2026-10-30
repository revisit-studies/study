import localforage from 'localforage';
import throttle from 'lodash.throttle';
import { v4 as uuidv4 } from 'uuid';
import { resolveBetweenSubjectsFactorLevels } from '../../parser/libraryParser';
import { StudyConfig } from '../../parser/types';
import { DISTINCT_COLOR_PALETTE } from '../../utils/colors';
import { ParticipantMetadata, Sequence, StoredProvenance } from '../../store/types';
import { ParticipantData, ParticipantDataWithStatus } from '../types';
import {
  countParticipantStatuses, getSequenceAssignmentStatus, statusConsumesCapacity,
} from '../participantStatus';
import { hash, isParticipantData } from './utils/storageEngineHelpers';
import { shouldPreferCachedParticipantData } from './utils/participantDataRecovery';
import { RevisitNotification } from '../../utils/notifications';
import { parseConditionParam } from '../../utils/handleConditionLogic';
import {
  ParticipantTags, Tag, TaglessEditedText, TranscribedAudio,
} from '../../analysis/individualStudy/thinkAloud/types';
import { normalizeStoredProvenance, splitProvenanceFromAnswers } from '../../store/provenance';
import { SnapshotParticipantCounts, calculateSnapshotParticipantCounts } from './utils/snapshotParticipantCounts';
import { getStageCombinationTargets } from './utils/stageAllocation';

export interface StoredUser {
  email: string | null,
  uid: string | null,
}

export interface UserWrapped {
  user: StoredUser | null,
  determiningStatus: boolean,
  isAdmin: boolean,
  adminVerification: boolean
}

export type SequenceAssignment = {
  participantId: string;
  timestamp: number; // Use Timestamp for Firebase, number for local storage
  rejected: boolean;
  claimed: boolean;
  claimedParticipantId?: string; // The original rejected participant whose slot this assignment is reusing.
  completed: number | null;
  /** The time this allocation stopped consuming capacity. Unlike rejection, the participant may still finish. */
  autoTimedOutAt?: number;
  createdTime: number;
  total: number; // Total number of questions/steps
  answered: string[]; // Number of answered questions
  isDynamic: boolean; // Whether the study contains dynamic blocks
  stage: string; // The stage of the participant in the study
  conditions?: string[]; // The study condition(s) assigned to this participant.
  betweenSubjectsCombinationKey?: string; // The between-subjects combination assigned to this participant.
  creationIndex?: number; // Stable zero-based participant creation order.
  sequenceIndex?: number; // Stable zero-based allocator slot.
  reusableSequenceIndex?: number;
  initialization?: { pending: string[]; complete: boolean }; // Overlapping first uploads share one reservation.
  sequenceKey?: string; // Config hash and prepared row index, used to balance active task orders.
};

export type REVISIT_MODE = 'dataCollectionEnabled' | 'developmentModeEnabled' | 'dataSharingEnabled';

export type RuntimeStudySettings = Record<REVISIT_MODE, boolean> & {
  stage?: StageData;
  /** Undefined disables lazy participant timeouts. */
  autoTimeoutMinutes?: number;
};

/** The study's runtime settings without the stage data stored alongside them. */
export type StudyModes = Omit<RuntimeStudySettings, 'stage'>;

export function cleanupModes(modes: Record<string, unknown>): Record<REVISIT_MODE, boolean> {
  const cleanedModes: Record<string, unknown> = { ...modes };

  if ('studyNavigatorEnabled' in modes && !('developmentModeEnabled' in modes)) {
    cleanedModes.developmentModeEnabled = modes.studyNavigatorEnabled;
    delete cleanedModes.studyNavigatorEnabled;
  }

  if ('analyticsInterfacePubliclyAccessible' in modes && !('dataSharingEnabled' in modes)) {
    cleanedModes.dataSharingEnabled = modes.analyticsInterfacePubliclyAccessible;
    delete cleanedModes.analyticsInterfacePubliclyAccessible;
  }

  return cleanedModes as Record<REVISIT_MODE, boolean>;
}

export interface StageInfo {
  stageName: string;
  color: string;
  /** Maximum number of non-rejected participants allowed in this stage. Undefined means unlimited. */
  maxParticipants?: number;
  /** Whether the saved maximum is enforced. Undefined preserves the legacy behavior of enabling any defined maximum. */
  participantLimitEnabled?: boolean;
  /** Condition definitions registered for this stage; append-only after its first assignment. */
  conditionKeys?: string[];
  /** Disabled between-subjects condition keys. Undefined means every condition is enabled. */
  disabledBetweenSubjectsCombinations?: string[];
  /** Legacy manual target participant-count overrides for individual between-subjects conditions. */
  desiredParticipantsByCombination?: Record<string, number>;
  /** The active participant allocation strategy. Stages created before this field existed infer manual mode from legacy overrides. */
  participantAssignmentMode?: 'even' | 'manual';
  /** Saved manual condition allocations, retained while the stage is using even allocation. */
  manualDesiredParticipantsByCombination?: Record<string, number>;
}

/** The fields of a {@link StageInfo} that an admin can change. An omitted field is left alone and a null clears it. */
export interface StageUpdates {
  color?: string;
  conditionKeys?: string[];
  maxParticipants?: number | null;
  participantLimitEnabled?: boolean | null;
  disabledBetweenSubjectsCombinations?: string[] | null;
  desiredParticipantsByCombination?: Record<string, number> | null;
  participantAssignmentMode?: 'even' | 'manual' | null;
  manualDesiredParticipantsByCombination?: Record<string, number> | null;
}

export function isStageParticipantLimitEnabled(
  stage: StageInfo,
): stage is StageInfo & { maxParticipants: number } {
  return stage.maxParticipants !== undefined && stage.participantLimitEnabled !== false;
}

export function applyStageUpdates(data: StageData, stageName: string, updates: StageUpdates): StageData {
  if (!data.allStages.some((stage) => stage.stageName === stageName)) throw new Error(`Stage ${stageName} not found`);
  return {
    currentStage: data.currentStage.stageName === stageName && updates.color !== undefined
      ? { ...data.currentStage, color: updates.color } : data.currentStage,
    allStages: data.allStages.map((stage) => {
      if (stage.stageName !== stageName) return stage;
      const next = { ...stage } as StageInfo & Record<string, unknown>;
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) delete next[key];
        else if (value !== undefined) next[key] = value;
      });
      return next;
    }),
  };
}

export class StageCapacityExceededError extends Error {
  constructor(public readonly stageName: string) {
    super(`The ${stageName} stage has reached its participant limit`);
    this.name = 'StageCapacityExceededError';
  }
}

export class StageNoAvailableConditionsError extends Error {
  constructor(public readonly stageName: string) {
    super(`The ${stageName} stage has no enabled between-subjects conditions`);
    this.name = 'StageNoAvailableConditionsError';
  }
}

export class StageOnlyDisabledConditionsHaveCapacityError extends Error {
  constructor(public readonly stageName: string) {
    super(`The ${stageName} stage only has capacity in disabled between-subjects conditions`);
    this.name = 'StageOnlyDisabledConditionsHaveCapacityError';
  }
}

export class StageConditionCapacityExceededError extends Error {
  constructor(public readonly stageName: string) {
    super(`The participant's between-subjects condition in the ${stageName} stage has reached its participant limit`);
    this.name = 'StageConditionCapacityExceededError';
  }
}

export interface StageData {
  currentStage: StageInfo;
  allStages: StageInfo[];
}

export type ModesAndStageData = {
  modes: StudyModes;
  stageData: StageData;
  sequenceArray?: Sequence[];
};

// Reuse the orders prepared during startup. Admission still rechecks policy
// under its own lock rather than trusting the earlier modes snapshot.
export type ParticipantSessionBootstrapData = {
  modesDocument: Record<REVISIT_MODE, boolean> & { stage?: StageData };
  sequenceArray: Sequence[];
};

export interface ConditionData {
  allConditions: string[];
  conditionCounts: Record<string, number>;
}

const defaultStageColor = DISTINCT_COLOR_PALETTE[0];

/** Whether an allocation still counts against the study's participant limits. */
export function consumesCapacity(assignment: SequenceAssignment) {
  return statusConsumesCapacity(getSequenceAssignmentStatus(assignment));
}

// Admission and stage policy changes share one lock so a participant cannot be
// committed against a stage configuration that changed mid-assignment.
const ADMISSION_POLICY_LOCK_KEY = 'participant-assignment';

export function getStageParticipantCounts(sequenceAssignments: SequenceAssignment[]) {
  return sequenceAssignments.reduce<Record<string, number>>((counts, assignment) => {
    if (consumesCapacity(assignment)) {
      counts[assignment.stage] = (counts[assignment.stage] || 0) + 1;
    }
    return counts;
  }, Object.create(null) as Record<string, number>);
}

export function getBetweenSubjectsCombinationKey(
  parameters: Record<string, unknown> | undefined,
  factorNames: string[],
) {
  return JSON.stringify(factorNames.map((factorName) => [factorName, parameters?.[factorName]]));
}

export function getConfigConditionKeys(config: StudyConfig) {
  const factors = config.betweenSubjects || [];
  const combinations = factors.reduce<Record<string, unknown>[]>((rows, factor) => {
    const levels = resolveBetweenSubjectsFactorLevels(factor, config.factors || {}) || [];
    return rows.flatMap((row) => levels.map((level) => ({ ...row, [factor]: level })));
  }, [{}]);
  return combinations.map((parameters) => getBetweenSubjectsCombinationKey(parameters, factors));
}

export function assertAppendOnlyConditions(previousKeys: string[], nextKeys: string[]) {
  if (previousKeys.some((key) => !nextKeys.includes(key))) {
    throw new Error('Conditions cannot be removed or renamed after participants have joined this stage. Disable recruitment or start a new stage.');
  }
}

export function validateStageParticipantLimits(stage: StageInfo, assignments: SequenceAssignment[], previousStage?: StageInfo) {
  const active = assignments.filter((assignment) => assignment.stage === stage.stageName && consumesCapacity(assignment));
  if (isStageParticipantLimitEnabled(stage)
    && (stage.maxParticipants !== previousStage?.maxParticipants || !previousStage || !isStageParticipantLimitEnabled(previousStage))
    && stage.maxParticipants < active.length) {
    throw new Error(`The stage maximum cannot be below the ${active.length} participants already assigned`);
  }
  const targets = stage.participantAssignmentMode === 'even'
    ? undefined
    : stage.manualDesiredParticipantsByCombination ?? stage.desiredParticipantsByCombination;
  const counts: Record<string, number> = {};
  active.forEach((assignment) => {
    if (assignment.betweenSubjectsCombinationKey) {
      const key = assignment.betweenSubjectsCombinationKey;
      counts[key] = (counts[key] || 0) + 1;
    }
  });
  const previousTargets = previousStage?.participantAssignmentMode === 'even'
    ? undefined : previousStage?.manualDesiredParticipantsByCombination ?? previousStage?.desiredParticipantsByCombination;
  Object.entries(targets || {}).forEach(([key, target]) => {
    if (target !== previousTargets?.[key] && target < (counts[key] || 0)) {
      throw new Error(`The condition target cannot be below the ${counts[key]} participants already assigned`);
    }
  });
}

export function isSequenceEnabledForStage(
  sequence: Sequence,
  stage: StageInfo,
  betweenSubjects: string[],
) {
  const disabledCombinations = stage.disabledBetweenSubjectsCombinations;
  if (!disabledCombinations) {
    return true;
  }

  return !disabledCombinations.includes(
    getBetweenSubjectsCombinationKey(sequence.parameters, betweenSubjects),
  );
}

export function getDesiredParticipantCountsByCombination(
  stage: StageInfo,
  sequenceArray: Sequence[],
  betweenSubjects: string[],
) {
  if (!isStageParticipantLimitEnabled(stage) || betweenSubjects.length === 0) {
    return undefined;
  }

  const combinationKeys = [...new Set(sequenceArray.map((sequence) => (
    getBetweenSubjectsCombinationKey(sequence.parameters, betweenSubjects)
  )))];
  const participantAssignmentMode = stage.participantAssignmentMode
    ?? (stage.desiredParticipantsByCombination ? 'manual' : 'even');
  const manuallySpecifiedCounts = participantAssignmentMode === 'manual'
    ? (stage.manualDesiredParticipantsByCombination ?? stage.desiredParticipantsByCombination)
    : undefined;

  return getStageCombinationTargets(
    stage.maxParticipants,
    combinationKeys,
    manuallySpecifiedCounts,
    stage.disabledBetweenSubjectsCombinations,
  );
}

// Chooses a sequence from the between-subjects condition furthest from its
// target, so new participants top up the condition that is behind. Conditions with
// a target are compared by the fraction of that target already filled, so unequal
// targets fill in proportion rather than largest-first; without targets the raw
// participant count is used.
export function getLeastServedSequence(
  sequences: Sequence[],
  combinationCounts: Record<string, number>,
  desiredParticipantCountsByCombination: Record<string, number> | undefined,
  betweenSubjects: string[],
  intentIndex: number,
  sequenceCounts: Map<Sequence, number>,
) {
  const combinationKeys = [...new Set(sequences.map((sequence) => (
    getBetweenSubjectsCombinationKey(sequence.parameters, betweenSubjects)
  )))];
  const servedFractions = combinationKeys.map((combinationKey) => {
    const count = combinationCounts[combinationKey] || 0;
    const desiredCount = desiredParticipantCountsByCombination?.[combinationKey];

    return desiredCount ? count / desiredCount : count;
  });
  const leastServedFraction = Math.min(...servedFractions);

  const leastServedKeys = combinationKeys.filter((_, index) => servedFractions[index] === leastServedFraction);
  const combinationKey = leastServedKeys[intentIndex % leastServedKeys.length];
  const combinationSequences = sequences.filter((sequence) => (
    getBetweenSubjectsCombinationKey(sequence.parameters, betweenSubjects) === combinationKey
  ));
  // Released allocations free a particular row, so choose the least-used active
  // row rather than advancing past the order that needs a replacement.
  return combinationSequences.reduce((leastUsed, sequence) => (
    sequenceCounts.get(sequence)! < sequenceCounts.get(leastUsed)! ? sequence : leastUsed
  ));
}

export type StorageObjectType = 'sequenceArray' | 'participantData' | 'config' | string;
export type StorageObject<T extends StorageObjectType> =
  T extends 'sequenceArray'
  ? Sequence[]
  : T extends 'participantData'
  ? ParticipantData
  : T extends 'config'
  ? StudyConfig
  : T extends 'transcription.txt'
  ? TranscribedAudio
  : T extends 'editedText'
  ? TaglessEditedText[]
  : T extends 'participantTags'
  ? ParticipantTags
  : T extends 'tags'
  ? Tag[]
  : Blob; // Fallback for any random string

interface CloudStorageEngineError {
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

// Represents snapshot metadata keyed by the snapshot storage directory name.
export type SnapshotDocContent = Record<string, {
  name: string;
  participantCounts?: SnapshotParticipantCounts;
}>;

export type FinalizeParticipantResult = {
  status: 'complete' | 'retry' | 'error';
  message?: string;
  retryable?: boolean;
};

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function cloneParticipantDataSnapshot(participantData: ParticipantData) {
  return structuredClone(participantData);
}

type AssetRetryOperation = () => Promise<unknown>;

type ProgressData = { total: number; answered: string[]; isDynamic: boolean };

type ProgressDataWrite = {
  participantId: string;
  progressData: ProgressData;
};

export type StageAllocation = { count: number; combinationCounts: Record<string, number>; rowCounts: Record<string, number> };

export type SequenceRowContext = { configHash: string; sequenceCount: number };

export function getStageAllocationFromAssignments(all: SequenceAssignment[], stage: string, sequenceRows?: SequenceRowContext): StageAllocation {
  // Rejected and auto-timed-out assignments have released their slot.
  const assignments = all.filter((assignment) => assignment.stage === stage && consumesCapacity(assignment));
  const combinationCounts: Record<string, number> = {};
  const rowCounts: Record<string, number> = {};
  const legacyIndexes = new Map<number, number>();
  if (sequenceRows && assignments.some((assignment) => !assignment.sequenceKey)) {
    // Match the legacy allocators: an unkeyed order's index is the number of
    // non-rejected assignments with an earlier timestamp, across all stages.
    all.filter((assignment) => !assignment.rejected).sort((a, b) => a.timestamp - b.timestamp).forEach((assignment, index) => {
      if (!legacyIndexes.has(assignment.timestamp)) legacyIndexes.set(assignment.timestamp, index);
    });
  }
  assignments.forEach((assignment) => {
    if (assignment.betweenSubjectsCombinationKey) combinationCounts[assignment.betweenSubjectsCombinationKey] = (combinationCounts[assignment.betweenSubjectsCombinationKey] || 0) + 1;
    const sequenceKey = assignment.sequenceKey || (sequenceRows
      ? `${sequenceRows.configHash}:${(assignment.sequenceIndex ?? legacyIndexes.get(assignment.timestamp)!) % sequenceRows.sequenceCount}`
      : undefined);
    if (sequenceKey) rowCounts[sequenceKey] = (rowCounts[sequenceKey] || 0) + 1;
  });
  return { count: assignments.length, combinationCounts, rowCounts };
}

export abstract class StorageEngine {
  protected engine: 'localStorage' | 'supabase' | 'firebase';

  protected testing: boolean;

  protected cloudEngine: boolean = false;

  protected connected = false;

  protected abstract participantStore: ReturnType<typeof localforage.createInstance>;

  protected collectionPrefix = import.meta.env.DEV ? 'dev-' : 'prod-';

  protected studyId: string | undefined;

  protected currentParticipantId: string | undefined;

  protected participantData: ParticipantData | undefined;

  protected participantDataWriteDelayMs = 3000;

  private pendingParticipantDataWrite:
    | { participantId: string; snapshot: ParticipantData; cache: boolean }
    | undefined;

  private pendingParticipantDataWriteTimer: ReturnType<typeof setTimeout> | null = null;

  private participantDataWriteChain: Promise<void> = Promise.resolve();

  private participantDataWriteError: Error | null = null;

  private participantDataWriteErrorListeners = new Set<(error: Error) => void>();

  private participantRejectionListeners = new Set<() => void>();

  private pendingAssetUploads = new Map<string, Promise<void>>();

  private pendingAssetOperations = new Set<Promise<unknown>>();

  private failedAssetUploads = new Map<string, Error>();

  private failedAssetRetryOperations = new Map<string, AssetRetryOperation>();

  private pendingProgressDataWrite: ProgressDataWrite | undefined;

  private assetUploadActivityVersion = 0;

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

  subscribeToParticipantDataWriteErrors(callback: (error: Error) => void) {
    this.participantDataWriteErrorListeners.add(callback);

    return () => {
      this.participantDataWriteErrorListeners.delete(callback);
    };
  }

  subscribeToCurrentParticipantRejection(callback: () => void) {
    this.participantRejectionListeners.add(callback);

    return () => {
      this.participantRejectionListeners.delete(callback);
    };
  }

  /*
  * PRIMITIVE METHODS
  * These methods are provided by the storage engine implementation and are used by the higher-level methods.
  */
  /* Storage ------------------------------------------------------------- */
  // Gets an object from the storage engine. The object is identified by its type and studyId.
  protected abstract _getFromStorage<T extends StorageObjectType>(prefix: string, type: T, studyId?: string, strict?: boolean): Promise<StorageObject<T> | null>;

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
  public abstract getAllSequenceAssignments(studyId: string): Promise<SequenceAssignment[]>;

  // Reads one participant's assignment without loading every participant in the study.
  public abstract getSequenceAssignment(studyId: string, participantId: string): Promise<SequenceAssignment | null>;

  // Creates a sequence assignment for the given participantId and sequenceAssignment. Cloud storage engines should use the realtime database to create the sequence assignment and should use the server to prevent race conditions (i.e. using server timestamps).
  protected abstract _createSequenceAssignment(participantId: string, sequenceAssignment: SequenceAssignment, withServerTimestamp: boolean): Promise<void>;

  // Updates specific top-level fields in an existing sequence assignment without modifying timestamp fields.
  // This operation is a shallow patch (no deep merge for nested objects).
  protected abstract _updateSequenceAssignmentFields(
    participantId: string,
    updatedFields: Partial<SequenceAssignment>,
  ): Promise<void>;

  // Gets a single sequence assignment for the given participantId.
  protected abstract _getSequenceAssignment(participantId: string): Promise<SequenceAssignment | null>;

  // Sets the participant to completed in the sequence assignments in the realtime database.
  protected abstract _completeCurrentParticipantRealtime(): Promise<void>;

  // Rejects the participant in the realtime database sequence assignments. This must also reverse any claimed sequence assignments.
  protected abstract _rejectParticipantRealtime(participantId: string, onlyIncomplete?: boolean): Promise<void | boolean>;

  // Unrejects the participant in the realtime database sequence assignments. This must also reverse any claimed sequence assignments.
  protected abstract _undoRejectParticipantRealtime(participantId: string): Promise<void>;

  // Helper function to claim a sequence assignment of the given participant in the realtime database.
  protected abstract _claimSequenceAssignment(participantId: string): Promise<void>;

  /**
   * Atomically marks an eligible assignment as timed out. Returns false when a
   * concurrent completion, rejection, or timeout made the assignment ineligible.
   * Sweeps supply their deadline so a fresh reservation at the same ID survives.
   */
  protected abstract _markSequenceAssignmentTimedOut(participantId: string, timedOutAt: number, deadline?: number): Promise<boolean>;

  /**
   * The backend's current time in milliseconds. Timeout eligibility must never
   * be decided from a participant's browser clock: this code runs when a new
   * participant opens the study, so a clock that runs fast would time out
   * active participants and a clock that runs slow would leave stale
   * assignments consuming capacity.
   */
  protected abstract _getServerTimeMs(): Promise<number>;

  // Runs an operation while holding a distributed lock for this study. This is used for
  // operations whose correctness depends on multiple reads and writes, such as assigning
  // the final available participant slot or rejecting a participant with a pending save.
  protected abstract _runWithLock<T>(lockKey: string, operation: () => Promise<T>): Promise<T>;

  // Sets up the study database (firestore, indexedDB, etc.) for the given studyId. Also sets the studyId in the storage engine.
  abstract initializeStudyDb(studyId: string): Promise<void>;

  // Connects to the storage engine. This method might not need to do anything for some storage engines, but it is required for consistency.
  // It should set the `connected` property to true if the connection is successful.
  abstract connect(): Promise<void>;

  // Gets the modes for the given studyId. The modes are stored as a record with the mode name as the key and a boolean value indicating whether the mode is enabled or not.
  abstract getModes(studyId: string): Promise<RuntimeStudySettings>;

  // Read modes for an access decision without creating a missing Supabase record.
  async getAccessModes(studyId: string): Promise<(Record<REVISIT_MODE, boolean> & { stage?: StageData }) | null> {
    return this.getModes(studyId);
  }

  // Sets the mode for the given studyId. The mode is stored as a record with the mode name as the key and a boolean value indicating whether the mode is enabled or not.
  // Modes share one document with the stage data, and stage edits rewrite that whole
  // document, so mode changes hold the same lock to keep either write from replacing
  // the other with a stale value.
  async setMode(studyId: string, mode: REVISIT_MODE, value: boolean): Promise<void> {
    await this._runWithLock(ADMISSION_POLICY_LOCK_KEY, async () => {
      await this._setMode(studyId, mode, value);
    });
  }

  // Engine primitive for setMode. Callers must hold the admission policy lock.
  protected abstract _setMode(studyId: string, mode: REVISIT_MODE, value: boolean): Promise<void>;

  async setAutoTimeoutMinutes(studyId: string, minutes: number | undefined): Promise<void> {
    if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 1)) {
      throw new Error('Auto-timeout must be a whole number of minutes greater than zero');
    }
    // Write only this field. Rewriting the whole settings document from a copy
    // read earlier would drop a stage or mode update that landed in between.
    await this._updateModesFields(studyId, { autoTimeoutMinutes: minutes });
  }

  // Gets the landing-page visibility for the given studyId. This method is used to check whether the study is hidden from the landing page or not.
  abstract getStudyHiddenFromLandingPage(studyId: string): Promise<boolean>;

  // Sets the landing-page visibility for the given studyId. This method is used to control whether the study is hidden from the landing page or not.
  abstract setStudyHiddenFromLandingPage(studyId: string, hidden: boolean): Promise<void>;

  // Protected helper: Sets the full modes document (including stage data and mode flags)
  protected abstract _setModesDocument(studyId: string, modesDocument: RuntimeStudySettings): Promise<void>;

  /**
   * Protected helper: merges the given settings fields into the stored document
   * without touching the fields it was not given. A field set to `undefined` is
   * removed from the stored document.
   *
   * Backends that store the settings as one opaque value cannot merge, so this
   * default serializes the read-modify-write behind the settings lock. A backend
   * that can merge field by field should override it and skip the lock.
   */
  protected async _updateModesFields(studyId: string, fields: Partial<RuntimeStudySettings>): Promise<void> {
    await this._runWithLock('study-settings', async () => {
      const modes = await this._readModesForUpdate(studyId);
      const updatedModes: Record<string, unknown> = { ...modes };
      Object.entries(fields).forEach(([field, value]) => {
        if (value === undefined) {
          delete updatedModes[field];
        } else {
          updatedModes[field] = value;
        }
      });
      await this._setModesDocument(studyId, updatedModes as RuntimeStudySettings);
    });
  }

  // Protected helper: reads the settings that `_updateModesFields` merges into
  // while it holds the settings lock. An engine whose `getModes` takes that lock
  // must override this to read without it.
  protected async _readModesForUpdate(studyId: string): Promise<RuntimeStudySettings> {
    return await this.getModes(studyId);
  }

  // Gets the audio URL for the given task and participantId. This method is used to fetch the audio file from the storage engine.
  protected abstract _getAudioUrl(task: string, participantId?: string): Promise<string | null>;

  // Gets the screen recording URL for the given task and participantId. This method is used to fetch the screen recording video file from the storage engine.
  protected abstract _getScreenRecordingUrl(task: string, participantId?: string): Promise<string | null>;

  // Gets the webcam recording URL for the given task and participantId.
  protected abstract _getWebcamRecordingUrl(task: string, participantId?: string): Promise<string | null>;

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
  protected abstract _addDirectoryNameToSnapshots(
    directoryName: string,
    studyId: string,
    participantCounts?: SnapshotParticipantCounts,
  ): Promise<void>;

  // Removes a snapshot from the metadata. This is used by removeSnapshotOrLive
  protected abstract _removeDirectoryNameFromSnapshots(directoryName: string, studyId: string): Promise<void>;

  // Updates a snapshot in the metadata. This is used by renameSnapshot
  protected abstract _changeDirectoryNameInSnapshots(oldName: string, newName: string, studyId: string): Promise<void>;

  // Updates participant status count metadata for an existing snapshot.
  protected abstract _updateSnapshotParticipantCounts(
    snapshotName: string,
    studyId: string,
    participantCounts: SnapshotParticipantCounts,
  ): Promise<void>;

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

  /*
  * HIGHER-LEVEL METHODS
  * These methods are used by the application to interact with the storage engine and provide consistent behavior across different storage engines.
  * They are built on top of the primitive methods and provide a more user-friendly interface.
  */
  // Verify study database using provided primitive from storage engine with a throttle of 10 seconds.
  protected async verifyStudyDatabase() {
    return await this.__throttleVerifyStudyDatabase();
  }

  private getParticipantDataSnapshotStorageKey(participantId: string) {
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    return `${this.collectionPrefix}${this.studyId}/participants/${participantId}/localParticipantData`;
  }

  private async cacheParticipantDataSnapshot(snapshot: ParticipantData, participantId?: string) {
    const targetParticipantId = participantId || this.currentParticipantId;
    if (!this.studyId || !targetParticipantId) {
      return;
    }

    try {
      await this.participantStore.setItem(
        this.getParticipantDataSnapshotStorageKey(targetParticipantId),
        cloneParticipantDataSnapshot(snapshot),
      );
    } catch (error) {
      console.warn('Failed to cache participant data locally:', error);
    }
  }

  private async getCachedParticipantDataSnapshot(participantId?: string) {
    const targetParticipantId = participantId || this.currentParticipantId;
    if (!this.studyId || !targetParticipantId) {
      return null;
    }

    try {
      const cachedParticipantData = await this.participantStore.getItem<ParticipantData>(
        this.getParticipantDataSnapshotStorageKey(targetParticipantId),
      );

      return isParticipantData(cachedParticipantData) ? cachedParticipantData : null;
    } catch (error) {
      console.warn('Failed to read cached participant data:', error);
      return null;
    }
  }

  private async removeCachedParticipantDataSnapshot(participantId?: string) {
    const targetParticipantId = participantId || this.currentParticipantId;
    if (!this.studyId || !targetParticipantId) {
      return;
    }

    try {
      await this.participantStore.removeItem(
        this.getParticipantDataSnapshotStorageKey(targetParticipantId),
      );
    } catch (error) {
      console.warn('Failed to remove cached participant data:', error);
    }
  }

  protected async getModesAndStageData(
    studyId: string,
    existingModesDocument?: Record<REVISIT_MODE, boolean> & { stage?: StageData },
  ): Promise<ModesAndStageData> {
    const modesDoc = existingModesDocument ?? await this.getModes(studyId);
    const { stage, ...modeValues } = modesDoc;

    if (stage) {
      return { modes: modeValues, stageData: stage };
    }

    const defaultStageData: StageData = {
      currentStage: { stageName: 'DEFAULT', color: defaultStageColor },
      allStages: [{ stageName: 'DEFAULT', color: defaultStageColor }],
    };

    await this._updateModesFields(studyId, { stage: defaultStageData });

    return { modes: modeValues, stageData: defaultStageData };
  }

  private clearPendingParticipantDataWriteTimer() {
    if (this.pendingParticipantDataWriteTimer) {
      clearTimeout(this.pendingParticipantDataWriteTimer);
      this.pendingParticipantDataWriteTimer = null;
    }
  }

  private recordParticipantDataWriteError(error: unknown) {
    const normalizedError = normalizeError(error);
    this.participantDataWriteError = normalizedError;

    this.participantDataWriteErrorListeners.forEach((listener) => {
      listener(normalizedError);
    });
  }

  private consumeParticipantDataWriteError() {
    const error = this.participantDataWriteError;
    this.participantDataWriteError = null;
    return error;
  }

  private async enqueueParticipantDataWrite(
    participantId: string,
    snapshot: ParticipantData,
    cache: boolean,
  ) {
    const write = async () => {
      this.participantDataWriteError = null;
      try {
        await this._runWithLock(`participant-${participantId}`, async () => {
          // An admin can reject a participant in another browser while this
          // client still has a debounced full-record write pending. The same
          // lock is held by rejectParticipant, so the check and write cannot
          // race with a rejection.
          const latestParticipant = await this._getFromStorage(
            `participants/${participantId}`,
            'participantData',
          );
          if (isParticipantData(latestParticipant) && latestParticipant.rejected) {
            if (participantId === this.currentParticipantId) {
              this.participantData = latestParticipant;
              this.clearPendingParticipantDataWriteTimer();
              this.pendingParticipantDataWrite = undefined;
              await this.cacheParticipantDataSnapshot(latestParticipant, participantId);
              this.participantRejectionListeners.forEach((listener) => listener());
            }
            return;
          }

          await this._pushToStorage(
            `participants/${participantId}`,
            'participantData',
            snapshot,
          );
        });

        if (cache) {
          await this._cacheStorageObject(
            `participants/${participantId}`,
            'participantData',
          );
        }
      } catch (error) {
        this.recordParticipantDataWriteError(error);
        throw this.participantDataWriteError;
      }
    };

    const queuedWrite = this.participantDataWriteChain
      .catch(() => undefined)
      .then(write);

    this.participantDataWriteChain = queuedWrite
      .then(() => undefined)
      .catch(() => undefined);

    return queuedWrite;
  }

  private scheduleParticipantDataWrite(snapshot: ParticipantData, cache: boolean = false) {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    this.pendingParticipantDataWrite = {
      participantId: this.currentParticipantId,
      snapshot: cloneParticipantDataSnapshot(snapshot),
      cache,
    };

    this.clearPendingParticipantDataWriteTimer();
    this.pendingParticipantDataWriteTimer = setTimeout(() => {
      const pendingWrite = this.pendingParticipantDataWrite;
      this.pendingParticipantDataWrite = undefined;
      this.pendingParticipantDataWriteTimer = null;

      if (!pendingWrite) {
        return;
      }

      this.enqueueParticipantDataWrite(
        pendingWrite.participantId,
        pendingWrite.snapshot,
        pendingWrite.cache,
      ).catch(() => undefined);
    }, this.participantDataWriteDelayMs);
  }

  protected async persistCurrentParticipantData(
    options: { immediate?: boolean; cache?: boolean } = {},
  ) {
    if (!this.currentParticipantId || this.participantData === undefined) {
      throw new Error('Participant not initialized');
    }

    const snapshot = cloneParticipantDataSnapshot(this.participantData);
    const { immediate = false, cache = false } = options;

    await this.cacheParticipantDataSnapshot(snapshot, this.currentParticipantId);
    await this.verifyStudyDatabase();

    if (!immediate) {
      this.scheduleParticipantDataWrite(snapshot, cache);
      return;
    }

    this.clearPendingParticipantDataWriteTimer();
    this.pendingParticipantDataWrite = undefined;
    await this.enqueueParticipantDataWrite(this.currentParticipantId, snapshot, cache);
  }

  async flushPendingParticipantData() {
    this.clearPendingParticipantDataWriteTimer();

    if (this.pendingParticipantDataWrite) {
      const pendingWrite = this.pendingParticipantDataWrite;
      this.pendingParticipantDataWrite = undefined;
      await this.enqueueParticipantDataWrite(
        pendingWrite.participantId,
        pendingWrite.snapshot,
        pendingWrite.cache,
      );
    }

    await this.participantDataWriteChain;

    const error = this.consumeParticipantDataWriteError();
    if (error) {
      throw error;
    }
  }

  async retryFailedWrites() {
    await this.connect();
    if (!this.isConnected()) {
      throw new Error(`Failed to reconnect to ${this.getEngine()} storage engine`);
    }

    await this.persistCurrentParticipantData({ immediate: true });

    const { pendingProgressDataWrite } = this;
    if (pendingProgressDataWrite) {
      await this.updateProgressData(
        pendingProgressDataWrite.progressData,
        pendingProgressDataWrite.participantId,
      );
    }

    const failedAssetRetryOperations = [...this.failedAssetRetryOperations.entries()];
    await Promise.all(failedAssetRetryOperations.map(
      ([assetKey, operation]) => this.trackAssetOperation(assetKey, operation),
    ));

    const assetUploadError = await this.waitForPendingAssetUploads();
    if (assetUploadError) {
      throw assetUploadError;
    }
  }

  private recordAssetUploadError(assetKey: string, error: unknown) {
    this.failedAssetUploads.set(assetKey, normalizeError(error));
  }

  private clearAssetUploadError(assetKey: string) {
    this.failedAssetUploads.delete(assetKey);
  }

  private getAssetUploadError() {
    return this.failedAssetUploads.values().next().value || null;
  }

  private noteAssetUploadActivity() {
    this.assetUploadActivityVersion += 1;
  }

  private async waitForAssetUploadIdleWindow() {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  private trackAssetOperation<T>(assetKey: string, operation: () => Promise<T>) {
    this.noteAssetUploadActivity();
    this.clearAssetUploadError(assetKey);
    this.failedAssetRetryOperations.delete(assetKey);

    const operationPromise = operation()
      .catch((error) => {
        const normalizedError = normalizeError(error);
        this.recordAssetUploadError(assetKey, normalizedError);
        this.failedAssetRetryOperations.set(assetKey, operation);
        throw normalizedError;
      })
      .finally(() => {
        this.pendingAssetOperations.delete(operationPromise);
        this.noteAssetUploadActivity();
      });

    this.pendingAssetOperations.add(operationPromise);

    return operationPromise;
  }

  private async waitForPendingAssetUploads(): Promise<Error | null> {
    const uploadPromises = [
      ...this.pendingAssetUploads.values(),
      ...this.pendingAssetOperations,
    ];
    if (uploadPromises.length === 0) {
      const activityVersion = this.assetUploadActivityVersion;
      await this.waitForAssetUploadIdleWindow();

      if (
        this.pendingAssetUploads.size === 0
        && this.pendingAssetOperations.size === 0
        && this.assetUploadActivityVersion === activityVersion
      ) {
        return this.getAssetUploadError();
      }

      return this.waitForPendingAssetUploads();
    }

    await Promise.allSettled(uploadPromises);

    return this.waitForPendingAssetUploads();
  }

  async getStageData(studyId: string): Promise<StageData> {
    const { stageData } = await this.getModesAndStageData(studyId);
    return stageData;
  }

  async getConditionData(studyId: string): Promise<ConditionData> {
    const sequenceAssignments = await this.getAllSequenceAssignments(studyId);
    const conditionCounts: Record<string, number> = {};

    sequenceAssignments.forEach((assignment) => {
      const normalizedConditions = parseConditionParam(assignment.conditions);
      const conditionValues = normalizedConditions.length > 0 ? normalizedConditions : ['default'];
      conditionValues.forEach((condition) => {
        conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
      });
    });

    return {
      allConditions: Object.keys(conditionCounts).sort(),
      conditionCounts,
    };
  }

  // Setting current stage
  async setCurrentStage(
    studyId: string,
    stageName: string,
    color: string = defaultStageColor,
    maxParticipants?: number,
  ): Promise<void> {
    // The modes document holds every stage, so a read-modify-write of one stage
    // would otherwise drop a concurrent admin's edit to a different stage.
    await this._runWithLock(ADMISSION_POLICY_LOCK_KEY, async () => {
      await this.setCurrentStageUnlocked(studyId, stageName, color, maxParticipants);
    });
  }

  private async setCurrentStageUnlocked(
    studyId: string,
    stageName: string,
    color: string,
    maxParticipants?: number,
  ): Promise<void> {
    const modesDoc = await this.getModes(studyId);

    // Initialize if doesn't exist or invalid
    if (!modesDoc.stage) {
      modesDoc.stage = {
        currentStage: { stageName: 'DEFAULT', color: defaultStageColor },
        allStages: [{ stageName: 'DEFAULT', color: defaultStageColor }],
      };
    }

    // Check if stage already exists in allStages
    const existingStageIndex = modesDoc.stage.allStages.findIndex(
      (s) => s.stageName === stageName,
    );

    if (existingStageIndex === -1) {
      modesDoc.stage.allStages.push({
        stageName,
        color,
        ...(maxParticipants === undefined ? {} : { maxParticipants }),
      });
    }

    modesDoc.stage.currentStage = { stageName, color };

    await this._updateModesFields(studyId, { stage: modesDoc.stage });
  }

  // Updating stage color
  async updateStageColor(studyId: string, stageName: string, color: string): Promise<void> {
    await this.updateStage(studyId, stageName, { color });
  }

  protected async changeStagePolicy(studyId: string, stageName: string, update: (stage: StageInfo) => StageUpdates | Promise<StageUpdates>) {
    await this._runWithLock(ADMISSION_POLICY_LOCK_KEY, async () => {
      const stage = (await this.getModes(studyId)).stage?.allStages.find((item) => item.stageName === stageName);
      if (!stage) throw new Error(`Stage ${stageName} not found`);
      await this.updateStageUnlocked(studyId, stageName, await update(stage));
    });
  }

  async updateStage(studyId: string, stageName: string, updates: StageUpdates): Promise<void> {
    await this.changeStagePolicy(studyId, stageName, () => updates);
  }

  async setStageCombinationEnabled(studyId: string, stageName: string, combinationKey: string, enabled: boolean) {
    await this.changeStagePolicy(studyId, stageName, (stage) => {
      const disabled = stage.disabledBetweenSubjectsCombinations || [];
      const next = enabled ? disabled.filter((key) => key !== combinationKey) : [...new Set([...disabled, combinationKey])];
      return { disabledBetweenSubjectsCombinations: next.length ? next : null };
    });
  }

  async setStageParticipantAssignmentMode(studyId: string, stageName: string, mode: 'even' | 'manual', combinationKeys: string[]) {
    await this.changeStagePolicy(studyId, stageName, (stage) => {
      if (mode === 'even') return { participantAssignmentMode: mode };
      const targets = getStageCombinationTargets(
        stage.maxParticipants,
        combinationKeys,
        stage.manualDesiredParticipantsByCombination ?? stage.desiredParticipantsByCombination,
        stage.disabledBetweenSubjectsCombinations,
      );
      if (!targets) throw new Error('Set a stage maximum before assigning participants manually');
      return {
        participantAssignmentMode: mode,
        manualDesiredParticipantsByCombination: targets,
        maxParticipants: Object.values(targets).reduce((total, count) => total + count, 0),
      };
    });
  }

  async setStageDesiredParticipants(studyId: string, stageName: string, combinationKey: string, desiredParticipants: number, initialDesiredParticipants: Record<string, number>) {
    await this.changeStagePolicy(studyId, stageName, async (stage) => {
      const configHash = await this._getCurrentConfigHash();
      const config = configHash ? await this._getFromStorage(`configs/${configHash}`, 'config', studyId) : undefined;
      if (configHash && !config?.sequence) throw new Error('The active study configuration could not be loaded. Please try again.');
      const keys = config?.sequence ? getConfigConditionKeys(config) : stage.conditionKeys ?? Object.keys(initialDesiredParticipants);
      if ((configHash || stage.conditionKeys) && !keys.includes(combinationKey)) throw new Error('This condition is no longer available. Please reload the study settings.');
      const saved = stage.manualDesiredParticipantsByCombination ?? stage.desiredParticipantsByCombination;
      const effective = getStageCombinationTargets(stage.maxParticipants, keys, saved, stage.disabledBetweenSubjectsCombinations) ?? initialDesiredParticipants;
      const targets = {
        ...Object.fromEntries(keys.map((key) => [key, effective[key] ?? 0])),
        [combinationKey]: desiredParticipants,
      };
      return {
        participantAssignmentMode: 'manual',
        manualDesiredParticipantsByCombination: targets,
        maxParticipants: Object.values(targets).reduce((total, count) => total + count, 0),
        conditionKeys: keys,
      };
    });
  }

  protected async updateStageUnlocked(studyId: string, stageName: string, updates: StageUpdates): Promise<void> {
    const modes = await this.getModes(studyId);
    if (!modes.stage) throw new Error('Stage data not initialized');
    const data = applyStageUpdates(modes.stage, stageName, updates);
    const assignments = await this.getAllSequenceAssignments(studyId);
    const stage = data.allStages.find((item) => item.stageName === stageName)!;
    validateStageParticipantLimits(stage, assignments, modes.stage.allStages.find((item) => item.stageName === stageName));
    if (assignments.some((assignment) => assignment.stage === stageName)) {
      assertAppendOnlyConditions(modes.stage.allStages.find((item) => item.stageName === stageName)!.conditionKeys || [], stage.conditionKeys || []);
    }
    // Write only the stage, so a concurrently saved setting such as the
    // auto-timeout is not replaced with the copy read above.
    await this._updateModesFields(studyId, { stage: data });
  }

  protected async validateStageConditions(studyId: string, keys: string[]) {
    const { stageData } = await this.getModesAndStageData(studyId);
    const stage = stageData.allStages.find((candidate) => candidate.stageName === stageData.currentStage.stageName)!;
    const assignments = await this.getAllSequenceAssignments(studyId);
    if (assignments.some((assignment) => assignment.stage === stage.stageName)) {
      assertAppendOnlyConditions(stage.conditionKeys || [], keys);
    }
    return stage;
  }

  private async registerStageConditions(studyId: string, keys: string[]) {
    const stage = await this.validateStageConditions(studyId, keys);
    if (JSON.stringify(stage.conditionKeys) !== JSON.stringify(keys)) {
      await this.updateStageUnlocked(studyId, stage.stageName, { conditionKeys: keys });
    }
  }

  async saveConfig(config: StudyConfig) {
    await this._runWithLock(ADMISSION_POLICY_LOCK_KEY, async () => {
      if (!this.studyId) throw new Error('Study ID is not set');
      const currentConfigHash = await this._getCurrentConfigHash();
      const configHash = await hash(JSON.stringify(config));
      if (currentConfigHash === configHash) return;
      const keys = getConfigConditionKeys(config);
      await this.validateStageConditions(this.studyId, keys);
      const storedConfig = currentConfigHash === configHash
        ? await this._getFromStorage(`configs/${configHash}`, 'config') : null;
      if (!storedConfig || Object.keys(storedConfig).length === 0) {
        await this._pushToStorage(`configs/${configHash}`, 'config', config);
        await this._cacheStorageObject(`configs/${configHash}`, 'config');
      }
      // Failed uploads must not advance the append-only condition definitions.
      await this.activateConfig(configHash, keys);
    });
  }

  protected async activateConfig(configHash: string, keys: string[]) {
    await this.registerStageConditions(this.studyId!, keys);
    if (await this._getCurrentConfigHash() !== configHash) await this._setCurrentConfigHash(configHash);
  }

  // Gets all configs from the storage engine based on the provided temporary hashes and studyId.
  async getAllConfigsFromHash(tempHashes: string[], studyId: string) {
    const allConfigs = tempHashes.map(async (singleHash) => [singleHash, await this._getFromStorage(`configs/${singleHash}`, 'config', studyId)]);
    const configs = (await Promise.all(allConfigs)) as [string, StudyConfig][];
    return Object.fromEntries(configs);
  }

  async getCurrentConfigHash(studyId: string) {
    await this.initializeStudyDb(studyId);
    return this._getCurrentConfigHash();
  }

  // Gets the current participant ID from the URL, local persistence, or generates a new one if none exists.
  async getCurrentParticipantId(urlParticipantId?: string) {
    // Prioritize urlParticipantId and avoid persisting it across pages.
    if (urlParticipantId) {
      this.currentParticipantId = urlParticipantId;
      return urlParticipantId;
    }

    if (this.currentParticipantId) {
      return this.currentParticipantId;
    }

    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const storageKey = `${this.collectionPrefix}${this.studyId}/currentParticipantId`;
    const storedParticipantId = await this.participantStore.getItem<string>(storageKey);
    if (storedParticipantId) {
      this.currentParticipantId = storedParticipantId;
      return storedParticipantId;
    }

    this.currentParticipantId = uuidv4();
    await this.participantStore.setItem(storageKey, this.currentParticipantId);
    return this.currentParticipantId;
  }

  // Returns the current participant ID if it already exists in memory or persistence without creating a new one.
  async peekCurrentParticipantId(studyId?: string) {
    const studyIdToUse = studyId || this.studyId;
    if (studyIdToUse) {
      const storageKey = `${this.collectionPrefix}${studyIdToUse}/currentParticipantId`;
      return await this.participantStore.getItem<string>(storageKey) || undefined;
    }

    return this.currentParticipantId;
  }

  // Clears the current participant ID from persistence and resets the currentParticipantId property.
  async clearCurrentParticipantId() {
    this.currentParticipantId = undefined;
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const storageKey = `${this.collectionPrefix}${this.studyId}/currentParticipantId`;
    await this.participantStore.removeItem(storageKey);
  }

  // This function is one of the most critical functions in the storage engine.
  // It uses the notion of sequence intents and assignments to determine the current sequence for the participant.
  // It handles rejected participants and allows for reusing a rejected participant's sequence.
  protected async _getSequence(
    conditions: string[] | undefined,
    bootstrapData: ModesAndStageData,
    config: StudyConfig,
    participantConfigHash: string,
  ) {
    if (!this.currentParticipantId || !this.studyId) throw new Error('Participant not initialized');
    const { modes, stageData } = bootstrapData;
    const stage = stageData.allStages.find((item) => item.stageName === stageData.currentStage.stageName)!;
    const sequences = bootstrapData.sequenceArray
      ?? await this.getSequenceArray(await this._getCurrentConfigHash() ? participantConfigHash : undefined);
    if (!sequences?.length) throw new Error('Latin square not initialized');
    const existing = modes.dataCollectionEnabled ? await this._getSequenceAssignment(this.currentParticipantId) : null;
    if (existing && !existing.rejected) {
      const allocation = await this._allocateSequenceAssignment(this.currentParticipantId, existing);
      const prefix = `${participantConfigHash}:`;
      const currentRow = existing.sequenceKey?.startsWith(prefix) ? sequences[Number(existing.sequenceKey.slice(prefix.length))]
        : existing.sequenceKey === undefined ? sequences[allocation.sequenceIndex % sequences.length] : undefined;
      if (!currentRow) throw new Error('The unfinished reservation uses a different study configuration. Please contact the study administrator.');
      return { currentRow, creationIndex: allocation.creationIndex + 1, stage: existing.stage };
    }
    const betweenSubjects = config.betweenSubjects || [];
    const keys = getConfigConditionKeys(config);
    const state = await this.getStageAllocation(stage.stageName, keys, modes.dataCollectionEnabled && betweenSubjects.length === 0
      ? { configHash: participantConfigHash, sequenceCount: sequences.length } : undefined);
    if (JSON.stringify(stage.conditionKeys) !== JSON.stringify(keys)) {
      if (stage.conditionKeys?.length && await this.hasStageAssignments(stage.stageName)) assertAppendOnlyConditions(stage.conditionKeys || [], keys);
      await this._updateModesFields(this.studyId, { stage: applyStageUpdates(stageData, stage.stageName, { conditionKeys: keys }) });
    }
    if (modes.dataCollectionEnabled && isStageParticipantLimitEnabled(stage) && state.count >= stage.maxParticipants) {
      throw new StageCapacityExceededError(stage.stageName);
    }
    const enabled = sequences.filter((row) => isSequenceEnabledForStage(row, stage, betweenSubjects));
    if (!enabled.length) throw new StageNoAvailableConditionsError(stage.stageName);
    const targets = getDesiredParticipantCountsByCombination(stage, sequences, betweenSubjects);
    const hasCapacity = (row: Sequence) => !modes.dataCollectionEnabled || !targets
      || (state.combinationCounts[getBetweenSubjectsCombinationKey(row.parameters, betweenSubjects)] || 0) < targets[getBetweenSubjectsCombinationKey(row.parameters, betweenSubjects)];
    const eligible = enabled.filter(hasCapacity);
    if (!eligible.length) {
      if (sequences.some((row) => !isSequenceEnabledForStage(row, stage, betweenSubjects) && hasCapacity(row))) throw new StageOnlyDisabledConditionsHaveCapacityError(stage.stageName);
      throw new StageCapacityExceededError(stage.stageName);
    }
    if (!modes.dataCollectionEnabled) return { currentRow: eligible[Math.floor(Math.random() * eligible.length)], creationIndex: 1 };
    const rowCounts = new Map(sequences.map((row, index) => [row, state.rowCounts[`${participantConfigHash}:${index}`] || 0]));
    const balancedRow = betweenSubjects.length ? getLeastServedSequence(eligible, state.combinationCounts, targets, betweenSubjects, state.count, rowCounts) : undefined;
    const timestamp = Date.now();
    const allocation = await this._allocateSequenceAssignment(this.currentParticipantId, {
      participantId: this.currentParticipantId,
      timestamp,
      createdTime: timestamp,
      rejected: false,
      claimed: false,
      completed: null,
      total: 0,
      answered: [],
      isDynamic: false,
      stage: stage.stageName,
      ...(conditions ? { conditions } : {}),
      ...(balancedRow ? {
        betweenSubjectsCombinationKey: getBetweenSubjectsCombinationKey(balancedRow.parameters, betweenSubjects),
        sequenceKey: `${participantConfigHash}:${sequences.indexOf(balancedRow)}`,
      } : {}),
    });
    const completeRowCounts = Object.values(state.rowCounts).reduce((total, count) => total + count, 0) === state.count;
    const currentRow = balancedRow ?? (completeRowCounts
      ? getLeastServedSequence(eligible, state.combinationCounts, targets, betweenSubjects, state.count, rowCounts)
      : eligible[allocation.sequenceIndex % eligible.length]);
    if (!balancedRow) {
      await this.updateSequenceAssignmentFieldsLocked(this.currentParticipantId, {
        sequenceKey: `${participantConfigHash}:${sequences.indexOf(currentRow)}`,
        betweenSubjectsCombinationKey: getBetweenSubjectsCombinationKey(currentRow.parameters, betweenSubjects),
      });
    }
    return { currentRow, creationIndex: allocation.creationIndex + 1 };
  }

  private async timeoutExpiredAssignments(modes: StudyModes): Promise<void> {
    const timeoutMinutes = modes.autoTimeoutMinutes;
    if (!modes.dataCollectionEnabled || timeoutMinutes === undefined) {
      return;
    }

    // `createdTime` is written by the backend in the cloud engines, so the
    // deadline it is compared against has to come from the backend too.
    const serverNow = await this._getServerTimeMs();
    const deadline = serverNow - timeoutMinutes * 60_000;
    const assignments = await this.getAllSequenceAssignments(this.studyId!);
    const expiredAssignments = assignments.filter((assignment) => (
      consumesCapacity(assignment)
      && assignment.completed === null
      && Number.isFinite(assignment.createdTime)
      && assignment.createdTime <= deadline
    ));

    // Each engine rechecks eligibility in the same operation that writes, so a
    // participant who finished or was rejected in the meantime keeps their slot.
    for (const assignment of expiredAssignments) {
      // Process serially so a failed mutation prevents any subsequent capacity
      // calculation from using an uncertain allocation state.
      // eslint-disable-next-line no-await-in-loop
      await this._markSequenceAssignmentTimedOut(assignment.participantId, serverNow, deadline);
    }
  }

  // Patches an assignment while holding its participant lock. Some engines
  // rewrite the whole record, so an unlocked patch could erase a completion,
  // rejection, or timeout written in the meantime. Callers that already hold
  // the participant lock call `_updateSequenceAssignmentFields` directly.
  private async updateSequenceAssignmentFieldsLocked(
    participantId: string,
    updatedFields: Partial<SequenceAssignment>,
  ) {
    await this._runWithLock(`participant-${participantId}`, async () => {
      await this._updateSequenceAssignmentFields(participantId, updatedFields);
    });
  }

  // Releases a sequence assignment created for the current participant during a
  // failed initialization. Rejecting the assignment frees the stage slot and
  // lets the next participant claim it, and reverses any slot this assignment
  // claimed from an earlier rejection. Failures here are swallowed: the caller
  // is already reporting the initialization error it is rolling back.
  protected async releaseInitialSequenceAssignment(_reservation?: { creationIndex: number; reservationToken?: string }) {
    if (!this.currentParticipantId) {
      return;
    }

    try {
      const assignment = await this._getSequenceAssignment(this.currentParticipantId);
      if (!assignment || assignment.rejected) {
        return;
      }
      await this._rejectParticipantRealtime(this.currentParticipantId);
    } catch (error) {
      console.warn('Error releasing the sequence assignment of a failed participant initialization:', error);
    }
  }

  // Rejects a sequence assignment that is still active although its participant
  // record was never written. Callers must hold the admission policy lock and have
  // checked that the participant record is missing, so the assignment cannot
  // belong to an initialization that is still in progress.
  protected async releaseOrphanedSequenceAssignment(participantId: string) {
    const assignment = await this._getSequenceAssignment(participantId);
    if (assignment && consumesCapacity(assignment)) {
      await this._rejectParticipantRealtime(participantId);
    }
  }

  protected hasAtomicSequenceReservation = false;

  protected async prepareParticipantReservation(participantId: string) {
    return this._getSequenceAssignment(participantId);
  }

  // Cloud backends can confirm the reservation before exposing a persisted session.
  protected async confirmParticipantReservation(_participant: ParticipantData, _reservationToken?: string, _fromCache = false): Promise<boolean> {
    return true;
  }

  // Initializes or resumes a participant session for the given studyId. This will create a new participant data object if it does not exist, or update the existing one.
  async initializeParticipantSession(
    searchParams: Record<string, string>,
    config: StudyConfig,
    metadata: ParticipantMetadata,
    urlParticipantId?: string,
    bootstrapData?: ParticipantSessionBootstrapData,
  ) {
    await this.verifyStudyDatabase();

    // Ensure that we have a participantId
    await this.getCurrentParticipantId(urlParticipantId);
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    let cachedParticipant = await this.getCachedParticipantDataSnapshot(this.currentParticipantId);
    if (cachedParticipant?.rejected) {
      // An admin may have restored the participant since this browser learned
      // about the rejection. A rejected cache must not permanently block saves.
      const current = await this._getFromStorage(`participants/${this.currentParticipantId}`, 'participantData');
      if (isParticipantData(current)) {
        cachedParticipant = current;
        await this.cacheParticipantDataSnapshot(current, this.currentParticipantId);
      }
    }
    if (cachedParticipant && await this.confirmParticipantReservation(cachedParticipant, undefined, true)) {
      this.participantData = cachedParticipant;
      return cachedParticipant;
    }

    // Check if the participant has already been initialized
    const participant = await this._getFromStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
    );

    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    if (isParticipantData(participant) && await this.confirmParticipantReservation(participant)) {
      // Participant already initialized
      this.participantData = participant;
      await this.cacheParticipantDataSnapshot(participant, this.currentParticipantId);
      return participant;
    }

    const initializeParticipant = async (): Promise<ParticipantData> => {
      // Another session may have completed initialization while this session waited
      // for the lock, so always read the participant record again inside it.
      const existingParticipant = await this._getFromStorage(
        `participants/${this.currentParticipantId}`,
        'participantData',
      );
      if (isParticipantData(existingParticipant) && await this.confirmParticipantReservation(existingParticipant)) {
        await this.cacheParticipantDataSnapshot(existingParticipant, this.currentParticipantId);
        return existingParticipant;
      }

      // A previous attempt can leave an active assignment with no participant
      // record when both its participant write and its own cleanup failed. Release
      // it before counting, so the participant's abandoned slot cannot keep them
      // out of the stage, and the retry below assigns them afresh.
      const existingReservation = await this.prepareParticipantReservation(this.currentParticipantId!);

      const { modes, stageData } = await this.getModesAndStageData(this.studyId!, this.cloudEngine ? undefined : bootstrapData?.modesDocument);
      await this.timeoutExpiredAssignments(modes);
      const currentStage = stageData.currentStage.stageName;
      const currentStageInfo = stageData.allStages.find((stage) => stage.stageName === currentStage);
      if (!this.hasAtomicSequenceReservation && modes.dataCollectionEnabled && (!existingReservation || existingReservation.rejected) && currentStageInfo && isStageParticipantLimitEnabled(currentStageInfo)) {
        const stageParticipantCounts = await this.getStageAllocation(currentStage, getConfigConditionKeys(config));
        if (stageParticipantCounts.count >= currentStageInfo.maxParticipants) {
          throw new StageCapacityExceededError(currentStage);
        }
      }

      const participantConfigHash = await hash(JSON.stringify(config));
      const parsedConditions = parseConditionParam(searchParams.condition);
      const conditions = parsedConditions.length > 0 ? parsedConditions : undefined;
      let sequence: { currentRow: Sequence; creationIndex: number; stage?: string; reservationToken?: string };
      try {
        sequence = await this._getSequence(conditions, { modes, stageData, sequenceArray: bootstrapData?.sequenceArray }, config, participantConfigHash);
      } catch (error) {
        // _getSequence writes the sequence assignment before it picks a row, so a
        // later failure leaves an assignment that occupies a stage slot with no
        // participant record for an admin to reject. Release it here, while the
        // assignment lock is still held, so the slot stays recoverable.
        await this.releaseInitialSequenceAssignment();
        throw error;
      }
      const { currentRow, creationIndex } = sequence;
      const participantData: ParticipantData = {
        participantId: this.currentParticipantId!,
        participantConfigHash,
        sequence: currentRow,
        participantIndex: creationIndex,
        answers: {},
        searchParams,
        conditions,
        metadata,
        rejected: false,
        participantTags: [],
        stage: sequence.stage ?? currentStage,
        createdTime: Date.now(),
      };

      this.participantData = participantData;
      let participantRecordPersisted = false;
      try {
        if (modes.dataCollectionEnabled) {
          // Do not expose a session until its participant record and assignment
          // both exist. Otherwise a failed first write can strand a capacity slot
          // and leave only a browser-local participant snapshot.
          await this.persistCurrentParticipantData({ immediate: true });
          participantRecordPersisted = true;
          if (!await this.confirmParticipantReservation(participantData, sequence.reservationToken)) {
            throw new Error('The participant reservation changed while joining. Please reload.');
          }
        } else {
          await this.cacheParticipantDataSnapshot(participantData, this.currentParticipantId);
        }
      } catch (error) {
        // After an acknowledged upload, retain the place if confirmation fails.
        // A retry can confirm the stored record; releasing it would undercount.
        if (!participantRecordPersisted) await this.releaseInitialSequenceAssignment(sequence);
        await this.removeCachedParticipantDataSnapshot(this.currentParticipantId);
        this.participantData = undefined;
        throw error;
      }

      return participantData;
    };

    // Atomic reservation engines own admission in the database transaction.
    // Serialize starts for the same participant without blocking other participants
    // on a slow upload. Admission itself remains transactional.
    const initializedParticipant = this.hasAtomicSequenceReservation
      ? await this._runWithLock(`initialize-participant-${this.currentParticipantId}`, initializeParticipant)
      : await this._runWithLock(ADMISSION_POLICY_LOCK_KEY, initializeParticipant);

    this.participantData = initializedParticipant;
    return initializedParticipant;
  }

  // Gets all participant IDs for the given studyId
  async getAllParticipantIds(studyId?: string) {
    const studyIdToUse = studyId ?? this.studyId;
    if (studyIdToUse === undefined) {
      throw new Error('Study ID is not set');
    }
    const sequenceAssignments = await this.getAllSequenceAssignments(studyIdToUse);
    return sequenceAssignments.map((assignment) => assignment.participantId);
  }

  async saveTags(tags: Tag[], tagType: string) {
    await this._pushToStorage(`audio/transcriptAndTags/${tagType}`, 'tags', tags);
  }

  async getTags(tagType: string) {
    return await this._getFromStorage(`audio/transcriptAndTags/${tagType}`, 'tags');
  }

  async getParticipantAndTaskTags(authEmail: string, participantId: string, createIfMissing = false) {
    const tags = await this._getFromStorage(`audio/transcriptAndTags/${authEmail}/${participantId}`, 'participantTags');

    if (tags?.participantTags) {
      return tags;
    }

    const emptyTags: ParticipantTags = { participantTags: [], taskTags: {} };

    if (createIfMissing) {
      await this.saveAllParticipantAndTaskTags(authEmail, participantId, emptyTags);
    }

    return emptyTags;
  }

  async getAllParticipantAndTaskTags(authEmail: string, participantId: string) {
    return this.getParticipantAndTaskTags(authEmail, participantId, true);
  }

  async saveAllParticipantAndTaskTags(authEmail: string, participantId: string, participantTags: ParticipantTags) {
    return this._pushToStorage(`audio/transcriptAndTags/${authEmail}/${participantId}`, 'participantTags', participantTags);
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

    if (isParticipantData(participantData)) {
      const targetParticipantId = participantId || this.currentParticipantId;
      const cachedParticipantData = targetParticipantId === this.currentParticipantId
        ? await this.getCachedParticipantDataSnapshot(targetParticipantId)
        : null;

      if (
        cachedParticipantData
        && shouldPreferCachedParticipantData(cachedParticipantData, participantData)
      ) {
        return cachedParticipantData;
      }

      if (targetParticipantId === this.currentParticipantId) {
        await this.cacheParticipantDataSnapshot(participantData, targetParticipantId);
      }
      return participantData;
    }

    if (!participantId || participantId === this.currentParticipantId) {
      return await this.getCachedParticipantDataSnapshot(participantId);
    }

    return null;
  }

  getCurrentParticipantDataSnapshot() {
    if (!this.participantData) {
      return null;
    }

    return cloneParticipantDataSnapshot(this.participantData);
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

    await this.persistCurrentParticipantData({ immediate: true });
  }

  // Removes participant tags from the current participant.
  async removeParticipantTags(tags: string[]): Promise<void> {
    await this.verifyStudyDatabase();

    if (!this.participantData) {
      throw new Error('Participant data not initialized');
    }
    this.participantData.participantTags = this.participantData.participantTags.filter((tag) => !tags.includes(tag));

    await this.persistCurrentParticipantData({ immediate: true });
  }

  // Updates the participant's stored search params.
  async updateParticipantSearchParams(searchParams: Record<string, string>) {
    await this.verifyStudyDatabase();

    if (!this.participantData) {
      throw new Error('Participant data not initialized');
    }

    this.participantData.searchParams = searchParams;

    await this.persistCurrentParticipantData({ immediate: true });
  }

  async updateParticipantMetadata(metadata: ParticipantMetadata) {
    await this.verifyStudyDatabase();

    if (!this.participantData) {
      throw new Error('Participant data not initialized');
    }

    this.participantData.metadata = metadata;

    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const modes = await this.getModes(this.studyId);
    if (!modes.dataCollectionEnabled) {
      await this.cacheParticipantDataSnapshot(this.participantData, this.currentParticipantId);
      return;
    }

    await this.persistCurrentParticipantData({ immediate: false });
  }

  async updateStudyCondition(condition: string | string[]) {
    await this.verifyStudyDatabase();

    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
    }

    const modes = await this.getModes(this.studyId);
    if (!modes.developmentModeEnabled) {
      throw new Error('Cannot update study condition when development mode is disabled');
    }

    if (!this.participantData) {
      throw new Error('Participant data not initialized');
    }

    const parsedConditions = parseConditionParam(condition);
    this.participantData.conditions = parsedConditions.length > 0 ? parsedConditions : undefined;

    await this.persistCurrentParticipantData({ immediate: true });

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    await this.updateSequenceAssignmentFieldsLocked(
      this.currentParticipantId,
      { conditions: this.participantData.conditions },
    );
  }

  // Rejects a participant with the given participantId and reason.
  async timeoutParticipant(participantId: string): Promise<void> {
    await this._runWithLock(`participant-${participantId}`, async () => {
      const assignment = await this._getSequenceAssignment(participantId);
      // An auto-timed-out participant has already released their slot and may
      // still finish, so a manual timeout must not turn them into a rejection.
      if (!assignment || assignment.completed !== null || assignment.rejected || assignment.autoTimedOutAt !== undefined) return;
      await this.rejectParticipantUnlocked(participantId, 'Timed out by admin', true);
    });
  }

  async rejectParticipant(participantId: string, reason: string): Promise<void> {
    const participantRecordMissing = await this._runWithLock(`participant-${participantId}`, () => (
      this.rejectParticipantUnlocked(participantId, reason)
    ));

    if (!participantRecordMissing) {
      return;
    }

    // Without a participant record, the only thing to reject is an assignment
    // left behind by an initialization whose writes and cleanup both failed.
    // Initialization writes the assignment and the record under the admission
    // lock, so holding it here keeps an initialization still in progress from
    // being mistaken for an abandoned one.
    const participantRecordCreated = await this._runWithLock(ADMISSION_POLICY_LOCK_KEY, async () => {
      const participant = await this._getFromStorage(
        `participants/${participantId}`,
        'participantData',
      );
      if (isParticipantData(participant)) {
        return true;
      }
      await this.releaseOrphanedSequenceAssignment(participantId);
      return false;
    });

    if (participantRecordCreated) {
      // The participant finished initializing while this call waited for the
      // lock, so reject the new record through the normal path.
      await this.rejectParticipant(participantId, reason);
    }
  }

  private async rejectParticipantUnlocked(participantId: string, reason: string, onlyIncomplete = false): Promise<boolean> {
    const participant = participantId === this.currentParticipantId && this.participantData
      ? this.participantData
      : await this._getFromStorage(
        `participants/${participantId}`,
        'participantData',
      );
    let participantRecordUpdated = false;

    try {
      if (!participant || !isParticipantData(participant)) {
        return true;
      }
      // An already rejected participant needs no further changes.
      if (participant.rejected) {
        return false;
      }

      // Create a copy with rejected flag for storage write
      // so that if the write fails, in-memory state is unchanged
      const rejectedParticipant: ParticipantData = {
        ...participant,
        rejected: {
          reason,
          timestamp: new Date().getTime(),
        },
      };
      // Push rejected copy to storage first
      await this._pushToStorage(
        `participants/${participantId}`,
        'participantData',
        rejectedParticipant,
      );
      participantRecordUpdated = true;

      const rejected = await this._rejectParticipantRealtime(participantId, onlyIncomplete);
      if (rejected === false) {
        await this._pushToStorage(`participants/${participantId}`, 'participantData', participant);
        return false;
      }

      // Update in-memory state only after the participant record and
      // sequence-assignment updates have both succeeded.
      if (participantId === this.currentParticipantId && this.participantData) {
        this.participantData = rejectedParticipant;
      }
      return false;
    } catch (error) {
      let realtimeRollbackError: unknown = null;
      try {
        if (participantRecordUpdated) {
          const originalCurrentParticipantId = this.currentParticipantId;
          if (!this.currentParticipantId) {
            this.currentParticipantId = participantId;
          }
          try {
            await this._undoRejectParticipantRealtime(participantId);
          } finally {
            this.currentParticipantId = originalCurrentParticipantId;
          }
        }
      } catch (rollbackError) {
        realtimeRollbackError = rollbackError;
        console.warn('Error rolling back rejected participant realtime state:', rollbackError);
      }

      try {
        if (participantRecordUpdated && participant && isParticipantData(participant)) {
          await this._pushToStorage(
            `participants/${participantId}`,
            'participantData',
            participant,
          );
        }
      } catch (rollbackError) {
        console.warn('Error rolling back rejected participant state:', rollbackError);
      }
      if (realtimeRollbackError) {
        console.warn('Participant rejection rollback completed with realtime inconsistencies.');
      }
      console.warn('Error rejecting participant:', error);
      throw normalizeError(error);
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
  async undoRejectParticipant(participantId: string) {
    // Admin restoration may exceed recruitment limits. Keep the admission lock
    // to coordinate rejected-slot ownership with new admissions.
    return await this._runWithLock(ADMISSION_POLICY_LOCK_KEY, () => this._runWithLock(`participant-${participantId}`, async () => {
      const assignment = await this._getSequenceAssignment(participantId);
      if (assignment?.claimed) {
        throw new Error('Cannot undo rejection after the participant slot has been reassigned');
      }

      const participant = participantId === this.currentParticipantId && this.participantData
        ? this.participantData
        : await this._getFromStorage(
          `participants/${participantId}`,
          'participantData',
        );
      let participantRecordUpdated = false;

      // If the user doesn't exist, return
      if (!participant || !isParticipantData(participant)) {
        return;
      }

      try {
        const restoredParticipant: ParticipantData = {
          ...participant,
          rejected: false,
        };
        await this._pushToStorage(
          `participants/${participantId}`,
          'participantData',
          restoredParticipant,
        );
        participantRecordUpdated = true;
        await this._undoRejectParticipantRealtime(participantId);

        if (participantId === this.currentParticipantId && this.participantData) {
          this.participantData = restoredParticipant;
        }
      } catch (error) {
        try {
          if (participantRecordUpdated && participant && isParticipantData(participant)) {
            await this._pushToStorage(
              `participants/${participantId}`,
              'participantData',
              participant,
            );
          }
        } catch (rollbackError) {
          console.warn('Error rolling back participant unrejection state:', rollbackError);
        }
        console.warn('Error undoing participant rejection:', error);
        throw normalizeError(error);
      }
    }));
  }

  // Un-rejects the current participant.
  async undoRejectCurrentParticipant() {
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    return await this.undoRejectParticipant(this.currentParticipantId);
  }

  // Gets all participant IDs for the current studyId or a provided studyId.
  async getAllParticipantsData(studyId: string): Promise<ParticipantDataWithStatus[]> {
    const sequenceAssignments = await this.getAllSequenceAssignments(studyId);
    const participantPulls = sequenceAssignments.map(async (assignment): Promise<ParticipantDataWithStatus | null> => {
      const { participantId } = assignment;
      const participantData = await this._getFromStorage(
        `participants/${participantId}`,
        'participantData',
        studyId,
      );

      if (isParticipantData(participantData)) {
        return {
          ...participantData,
          completed: assignment.completed !== null,
          timedOut: assignment.autoTimedOutAt !== undefined,
          assignmentCreatedTime: assignment.createdTime,
        } satisfies ParticipantDataWithStatus;
      }
      return null;
    });

    const participantsData = await Promise.all(participantPulls);
    return participantsData.filter((participant): participant is ParticipantDataWithStatus => participant !== null);
  }

  async getParticipantsStatusCounts(studyId: string) {
    const sequenceAssignments = await this.getAllSequenceAssignments(studyId);

    const counts = countParticipantStatuses(sequenceAssignments, getSequenceAssignmentStatus);
    const minTime = sequenceAssignments.length > 0 ? sequenceAssignments[0].timestamp : null;
    const maxTime = sequenceAssignments.length > 0 ? sequenceAssignments.at(-1)!.timestamp : null;

    return {
      ...counts,
      minTime,
      maxTime,
    };
  }

  // Save the answer into the local participant data and queue a debounced write to storage.
  async saveAnswers(answers: ParticipantData['answers']) {
    if (!this.currentParticipantId || this.participantData === undefined) {
      throw new Error('Participant not initialized');
    }

    // Don't save further answers if participant is rejected
    if (this.participantData.rejected) {
      return;
    }

    const {
      answers: answersWithoutProvenance,
      provenanceByIdentifier,
    } = splitProvenanceFromAnswers(answers);
    const provenanceUploadPromises = Object.entries(provenanceByIdentifier).map(
      ([taskName, provenanceGraph]) => this.saveProvenance(provenanceGraph, taskName),
    );

    // Update the local copy of the participant data
    this.participantData = {
      ...this.participantData,
      answers: answersWithoutProvenance,
    };

    await this.cacheParticipantDataSnapshot(this.participantData, this.currentParticipantId);
    this.scheduleParticipantDataWrite(this.participantData);
    await Promise.all(provenanceUploadPromises);
  }

  // Updates the progress data in the sequence assignment
  async updateProgressData(
    progressData: ProgressData,
    participantId?: string,
  ) {
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const targetParticipantId = participantId || this.currentParticipantId;
    if (!targetParticipantId) {
      throw new Error('Participant not initialized');
    }

    const progressDataWrite: ProgressDataWrite = {
      participantId: targetParticipantId,
      progressData: structuredClone(progressData),
    };
    this.pendingProgressDataWrite = progressDataWrite;

    try {
      await this._runWithLock(`participant-${targetParticipantId}`, async () => {
        const existingAssignment = await this._getSequenceAssignment(targetParticipantId);

        if (existingAssignment) {
          await this._updateSequenceAssignmentFields(targetParticipantId, {
            total: progressData.total,
            answered: progressData.answered,
            isDynamic: progressData.isDynamic,
          });
        }
      });

      if (this.pendingProgressDataWrite === progressDataWrite) {
        this.pendingProgressDataWrite = undefined;
      }
    } catch (error) {
      this.recordParticipantDataWriteError(error);
      throw error;
    }
  }

  async getParticipantCompletionStatus(participantId?: string, studyId?: string): Promise<boolean> {
    const studyIdToUse = this.studyId || studyId;
    const participantIdToUse = participantId || this.currentParticipantId;

    if (!studyIdToUse) {
      throw new Error('Study not initialized');
    }

    if (!participantIdToUse) {
      throw new Error('Participant not initialized');
    }

    if (studyIdToUse !== this.studyId) {
      await this.initializeStudyDb(studyIdToUse);
    }
    const sequenceAssignment = await this._getSequenceAssignment(participantIdToUse);

    return sequenceAssignment ? sequenceAssignment.completed !== null : false;
  }

  async finalizeParticipant(): Promise<FinalizeParticipantResult> {
    try {
      await this.flushPendingParticipantData();
    } catch (error) {
      return {
        status: 'error',
        message: normalizeError(error).message,
      };
    }

    const assetUploadError = await this.waitForPendingAssetUploads();

    if (!this.studyId) {
      throw new Error('Study not initialized');
    }

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    const modes = await this.getModes(this.studyId);
    if (!modes.dataCollectionEnabled) {
      return { status: 'complete' };
    }

    const alreadyCompleted = await this.getParticipantCompletionStatus();
    if (alreadyCompleted) {
      return { status: 'complete' };
    }

    if (assetUploadError) {
      return {
        status: 'error',
        message: assetUploadError.message,
        retryable: false,
      };
    }

    try {
      await this._runWithLock(`participant-${this.currentParticipantId}`, async () => {
        const assignment = await this._getSequenceAssignment(this.currentParticipantId!);
        if (assignment?.rejected) throw new Error('This participant has been timed out or rejected');
        await this._completeCurrentParticipantRealtime();
      });
    } catch (error) {
      return {
        status: 'error',
        message: normalizeError(error).message,
      };
    }

    return { status: 'complete' };
  }

  async getAsset(url: string | null) {
    if (!url) {
      return null;
    }

    const asset = new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';
      xhr.onload = () => {
        const blob = xhr.response;
        try {
          resolve(URL.createObjectURL(blob));
        } finally {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        }
      };
      xhr.onerror = () => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
        reject(new Error(`Failed to load asset: ${url}`));
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

  private async parseProvenanceStorageObject(provenanceObject: unknown): Promise<StoredProvenance | null> {
    if (typeof Blob !== 'undefined' && provenanceObject instanceof Blob) {
      try {
        return normalizeStoredProvenance(JSON.parse(await provenanceObject.text()));
      } catch {
        return null;
      }
    }

    return normalizeStoredProvenance(provenanceObject);
  }

  async getProvenance(
    task: string,
    participantId?: string,
    strict = false,
  ) {
    const targetParticipantId = participantId || this.currentParticipantId;
    if (!targetParticipantId) {
      throw new Error('Participant not initialized');
    }

    const provenanceObject = await this._getFromStorage(
      `provenance/${targetParticipantId}`,
      task,
      undefined,
      strict,
    );

    if (strict && provenanceObject != null) {
      const parsed = typeof Blob !== 'undefined' && provenanceObject instanceof Blob
        ? JSON.parse(await provenanceObject.text()) : provenanceObject;
      const normalized = normalizeStoredProvenance(parsed);
      if (!normalized && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some((value) => value != null))) {
        throw new Error('Saved interaction history is invalid.');
      }
      return normalized;
    }
    return this.parseProvenanceStorageObject(provenanceObject);
  }

  async deleteProvenance(taskName: string) {
    if (!this.currentParticipantId || !this.studyId) {
      return;
    }
    try {
      await this._deleteFromStorage(`provenance/${this.currentParticipantId}`, taskName);
    } catch (error) {
      console.warn(`Failed to delete provenance for task ${taskName}:`, error);
    }
  }

  async saveProvenance(
    provenanceGraph: StoredProvenance | null | undefined,
    taskName: string,
  ) {
    const provenanceToSave = normalizeStoredProvenance(provenanceGraph);
    if (!provenanceToSave) {
      await this.deleteProvenance(taskName);
      return undefined;
    }

    return this.trackAssetOperation(`provenance/${taskName}`, async () => {
      if (this.studyId === undefined) {
        throw new Error('Study ID is not set');
      }
      if (!this.currentParticipantId) {
        throw new Error('Participant not initialized');
      }
      const modes = await this.getModes(this.studyId);
      if (!modes.dataCollectionEnabled) {
        throw new Error('Data collection is disabled for this study');
      }

      await this._pushToStorage(
        `provenance/${this.currentParticipantId}`,
        taskName,
        provenanceToSave as unknown as StorageObject<typeof taskName>,
      );

      try {
        await this._cacheStorageObject(`provenance/${this.currentParticipantId}`, taskName);
      } catch (error) {
        console.warn(`Failed to update cache headers for provenance ${taskName}:`, error);
      }
    });
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
    blob: Blob,
    taskName: string,
  ) {
    const assetKey = `${prefix}/${taskName}`;
    const participantKey = `${prefix}/${this.currentParticipantId}`;
    const uploadPromise = (async () => {
      try {
        await this._pushToStorage(participantKey, taskName, blob);
        this.clearAssetUploadError(assetKey);

        try {
          await this._cacheStorageObject(participantKey, taskName);
        } catch (error) {
          console.warn(`Failed to update cache headers for asset ${assetKey}:`, error);
        }
      } catch (error) {
        const normalizedError = normalizeError(error);
        this.recordAssetUploadError(assetKey, normalizedError);
        throw normalizedError;
      } finally {
        this.pendingAssetUploads.delete(assetKey);
      }
    })();

    this.pendingAssetUploads.set(assetKey, uploadPromise);

    await uploadPromise;
  }

  // Saves the audio stream to the storage engine. This method is used to save the audio recorded data from a MediaRecorder stream.
  async saveAudioRecording(
    blob: Blob,
    taskName: string,
  ) {
    return this.trackAssetOperation(`audio/${taskName}`, async () => {
      if (this.studyId === undefined) {
        throw new Error('Study ID is not set');
      }
      const modes = await this.getModes(this.studyId);
      if (!modes.dataCollectionEnabled) {
        throw new Error('Data collection is disabled for this study');
      }
      return this.saveAsset('audio', blob, taskName);
    });
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
    return this.trackAssetOperation(`screenRecording/${taskName}`, async () => {
      if (this.studyId === undefined) {
        throw new Error('Study ID is not set');
      }
      const modes = await this.getModes(this.studyId);
      if (!modes.dataCollectionEnabled) {
        throw new Error('Data collection is disabled for this study');
      }
      return this.saveAsset('screenRecording', blob, taskName);
    });
  }

  // Gets the webcam recording for a specific task and participantId.
  async getWebcamRecording(
    task: string,
    participantId: string,
  ) {
    const url = await this._getWebcamRecordingUrl(task, participantId);
    return this.getAsset(url);
  }

  // Saves the webcam video stream as a separate per-task asset.
  async saveWebcamRecording(
    blob: Blob,
    taskName: string,
  ) {
    return this.trackAssetOperation(`webcamRecording/${taskName}`, async () => {
      if (this.studyId === undefined) {
        throw new Error('Study ID is not set');
      }
      const modes = await this.getModes(this.studyId);
      if (!modes.dataCollectionEnabled) {
        throw new Error('Data collection is disabled for this study');
      }
      return this.saveAsset('webcamRecording', blob, taskName);
    });
  }

  // Gets the sequence array from the storage engine.
  async getSequenceArray(configHash?: string) {
    await this.verifyStudyDatabase();

    const version = configHash ?? await this._getCurrentConfigHash();
    const sequenceArrayDocData = await this._getFromStorage(
      version ? `configs/${version}` : '',
      'sequenceArray',
    );

    return Array.isArray(sequenceArrayDocData) ? sequenceArrayDocData : null;
  }

  // Only first-time preparation takes a config-specific lock. Every caller gets
  // the published array, including callers that waited for another publisher.
  async getOrCreateSequenceArray(configHash: string, generate: () => Sequence[]) {
    const existing = await this.getSequenceArray(configHash);
    if (existing) return existing;

    return this._runWithLock(`prepare-sequences-${configHash}`, async () => {
      const prepared = await this.getSequenceArray(configHash);
      if (prepared) return prepared;
      const sequences = generate();
      await this.setSequenceArray(sequences, configHash);
      return sequences;
    });
  }

  // Sets the sequence array in the storage engine.
  async setSequenceArray(latinSquare: Sequence[], configHash?: string) {
    await this.verifyStudyDatabase();

    const version = configHash ?? await this._getCurrentConfigHash();
    await this._pushToStorage(version ? `configs/${version}` : '', 'sequenceArray', latinSquare);
  }

  protected async __testingReset() {
    this.clearPendingParticipantDataWriteTimer();
    this.pendingParticipantDataWrite = undefined;
    this.participantDataWriteChain = Promise.resolve();
    this.participantDataWriteError = null;
    this.pendingAssetUploads.clear();
    this.pendingAssetOperations.clear();
    this.failedAssetUploads.clear();
    this.failedAssetRetryOperations.clear();
    this.pendingProgressDataWrite = undefined;
    this.assetUploadActivityVersion = 0;
    this.participantData = undefined;
    if (this.studyId) {
      await this.clearCurrentParticipantId();
    } else {
      this.currentParticipantId = undefined;
    }
  }

  /* Snapshots --------------------------------------------------------- */
  // Creates a snapshot of the current study data. This will copy the current study data to a new directory with a timestamp.
  async createSnapshot(
    studyId: string,
    deleteData: boolean,
  ): Promise<ActionResponse> {
    const sourceName = `${this.collectionPrefix}${studyId}`;
    const hasLiveData = this.getEngine() === 'localStorage'
      ? await this._directoryExists(`${sourceName}/participants`)
      : (await this.getAllSequenceAssignments(studyId)).length > 0;

    if (!hasLiveData) {
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
    const participantCounts = calculateSnapshotParticipantCounts(await this.getAllParticipantsData(studyId));

    if (this.getEngine() === 'localStorage') {
      await this._copyDirectory(`${sourceName}/`, `${targetName}/`);
    } else {
      await this._copyDirectory(`${sourceName}/configs`, `${targetName}/configs`);
      await this._copyDirectory(`${sourceName}/participants`, `${targetName}/participants`);
      await this._copyDirectory(`${sourceName}/audio`, `${targetName}/audio`);
      await this._copyDirectory(`${sourceName}/screenRecording`, `${targetName}/screenRecording`);
      await this._copyDirectory(`${sourceName}/webcamRecording`, `${targetName}/webcamRecording`);
      await this._copyDirectory(`${sourceName}/provenance`, `${targetName}/provenance`);
      await this._copyDirectory(sourceName, targetName);
      await this._copyRealtimeData(sourceName, targetName);
    }
    await this._addDirectoryNameToSnapshots(targetName, studyId, participantCounts);

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
        await this._deleteDirectory(`${deletionTarget}/webcamRecording`);
        await this._deleteDirectory(`${deletionTarget}/provenance`);
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
      await this._copyDirectory(
        `${snapshotName}/webcamRecording`,
        `${originalName}/webcamRecording`,
      );
      await this._copyDirectory(
        `${snapshotName}/provenance`,
        `${originalName}/provenance`,
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

  async updateSnapshotParticipantCounts(
    studyId: string,
    snapshotName: string,
    participantCounts: SnapshotParticipantCounts,
  ) {
    await this._updateSnapshotParticipantCounts(snapshotName, studyId, participantCounts);
  }

  protected abstract _allocateSequenceAssignment(
    participantId: string,
    sequenceAssignment: SequenceAssignment,
  ): Promise<SequenceAssignmentAllocation>;

  protected async hasStageAssignments(stage: string): Promise<boolean> { return (await this.getAllSequenceAssignments(this.studyId!)).some((assignment) => assignment.stage === stage); }

  protected async getStageAllocation(stage: string, _conditionKeys: string[] = [], sequenceRows?: SequenceRowContext): Promise<StageAllocation> {
    return getStageAllocationFromAssignments(await this.getAllSequenceAssignments(this.studyId!), stage, sequenceRows);
  }
}

export type UserManagementData = { authentication?: { isEnabled: boolean }; adminUsers?: { adminUsersList: StoredUser[] } };

// A StorageEngine that is specifically designed to work with cloud storage solutions like Firebase, Supabase, etc.
// It extends the StorageEngine class and provides additional methods for cloud storage operations (such as authentication, snapshots, etc.).
export abstract class CloudStorageEngine extends StorageEngine {
  protected cloudEngine = true;

  protected userManagementData: UserManagementData = {};

  abstract getStorageDisconnected(studyId: string): Promise<boolean>;

  protected abstract _setStorageDisconnected(studyId: string, disconnected: boolean): Promise<void>;

  protected abstract getAuthenticatedUser(): Promise<StoredUser | null>;

  async isStorageAdmin() {
    this.userManagementData = {};
    const auth = await this.getUserManagementData('authentication');
    const signedInUser = await this.getAuthenticatedUser();
    if (!auth?.isEnabled || !signedInUser?.email || !signedInUser.uid) return false;
    const adminUsers = await this.getUserManagementData('adminUsers');
    return Boolean(adminUsers?.adminUsersList.some((admin) => admin.email === signedInUser.email
      && (admin.uid === null || admin.uid === signedInUser.uid)));
  }

  async setStorageDisconnected(studyId: string, disconnected: boolean) {
    if (!await this.isStorageAdmin()) {
      throw new Error('A verified administrator must sign in to change storage.');
    }

    await this._setStorageDisconnected(studyId, disconnected);
  }

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

  abstract login(): Promise<StoredUser | null | void>;

  abstract unsubscribe(callback: (user: StoredUser | null) => Promise<void>): () => void;

  abstract logout(): Promise<void>;

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
      return this.engine !== 'supabase' || authInfo?.isEnabled === false;
    }
    return false;
  }
}

export type SequenceAllocator = {
  nextSequenceIndex: number;
  nextCreationIndex: number;
  availableSequenceIndexes?: number[]; // Unused replacement vacancies returned by undoing rejection.
};

export type SequenceAssignmentAllocation = {
  sequenceIndex: number;
  creationIndex: number;
};
