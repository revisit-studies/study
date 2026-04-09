import { vi } from 'vitest';
import type {
  GlobalConfig, StudyConfig, StudyMetadata, UIConfig,
} from '../parser/types';
import type { StoredAnswer, Sequence } from '../store/types';
import type { ParticipantData } from '../storage/types';
import { SequenceAssignment, StorageEngine } from '../storage/engines/types';

type StudyConfigOverrides = Omit<Partial<StudyConfig>, 'studyMetadata' | 'uiConfig' | 'sequence' | 'components'> & {
  studyMetadata?: Partial<StudyMetadata>;
  uiConfig?: Partial<UIConfig> & Record<string, unknown>;
  sequence?: StudyConfig['sequence'] | Sequence;
  components?: Record<string, Partial<StudyConfig['components'][string]>>;
};

const defaultStudyMetadata: StudyMetadata = {
  title: 'Test Study',
  version: '1.0',
  authors: ['Test'],
  date: '2026-04-08',
  description: 'Test',
  organizations: ['Test Org'],
};

const defaultUiConfig: UIConfig = {
  logoPath: '',
  contactEmail: 'test@test.com',
  withProgressBar: false,
  withSidebar: false,
};

export function makeStudyConfig(overrides: StudyConfigOverrides = {}): StudyConfig {
  const { studyMetadata, uiConfig, ...rest } = overrides;
  return {
    $schema: '',
    studyMetadata: { ...defaultStudyMetadata, ...studyMetadata },
    uiConfig: { ...defaultUiConfig, ...uiConfig },
    components: {},
    sequence: { order: 'fixed', components: [] },
    ...rest,
  } as StudyConfig;
}

class TestStorageEngine extends StorageEngine {
  protected override connected = true;

  // Abstract stubs required by StorageEngine
  protected participantStore = null!;

  protected _getFromStorage = vi.fn(async () => null);

  protected _pushToStorage = vi.fn(async () => { });

  protected _deleteFromStorage = vi.fn(async () => { });

  protected _cacheStorageObject = vi.fn(async () => { });

  protected _verifyStudyDatabase = vi.fn(async () => { });

  protected _getCurrentConfigHash = vi.fn(async () => null);

  protected _setCurrentConfigHash = vi.fn(async () => { });

  protected _createSequenceAssignment = vi.fn(async () => { });

  protected _updateSequenceAssignmentFields = vi.fn(async () => { });

  protected _completeCurrentParticipantRealtime = vi.fn(async () => { });

  protected _rejectParticipantRealtime = vi.fn(async () => { });

  protected _undoRejectParticipantRealtime = vi.fn(async () => { });

  protected _claimSequenceAssignment = vi.fn(async () => { });

  protected _setModesDocument = vi.fn(async () => { });

  protected _getAudioUrl = vi.fn(async () => null);

  protected _getScreenRecordingUrl = vi.fn(async () => null);

  protected _testingReset = vi.fn(async () => { });

  protected _directoryExists = vi.fn(async () => false);

  protected _copyDirectory = vi.fn(async () => { });

  protected _deleteDirectory = vi.fn(async () => { });

  protected _copyRealtimeData = vi.fn(async () => { });

  protected _deleteRealtimeData = vi.fn(async () => { });

  protected _addDirectoryNameToSnapshots = vi.fn(async () => { });

  protected _removeDirectoryNameFromSnapshots = vi.fn(async () => { });

  protected _changeDirectoryNameInSnapshots = vi.fn(async () => { });

  // Public stubs used by tests
  getAllSequenceAssignments = vi.fn(async () => []);

  initializeStudyDb = vi.fn(async () => { });

  connect = vi.fn(async () => { });

  getModes = vi.fn(async () => ({ dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false }));

  setMode = vi.fn(async () => { });

  getSnapshots = vi.fn(async () => ({}));

  addParticipantTags = vi.fn(async () => { });

  getAudioUrl = vi.fn(async () => null);

  getTranscriptUrl = vi.fn(async () => null);

  getScreenRecording = vi.fn(async () => null);

  saveAnswers = vi.fn(async () => { });

  constructor() {
    super('localStorage', true);
  }
}

export function makeStorageEngine(overrides: Partial<StorageEngine> = {}): StorageEngine {
  const engine = new TestStorageEngine();
  return Object.assign(engine, overrides);
}

export function makeGlobalConfig(overrides: Partial<GlobalConfig> = {}): GlobalConfig {
  return {
    $schema: '',
    configs: {},
    configsList: [],
    ...overrides,
  };
}

export function makeStoredAnswer(overrides: Partial<StoredAnswer> = {}): StoredAnswer {
  return {
    answer: {},
    identifier: 'test_0',
    componentName: 'test',
    trialOrder: '0',
    incorrectAnswers: {},
    startTime: 0,
    endTime: -1,
    provenanceGraph: {
      sidebar: undefined,
      aboveStimulus: undefined,
      belowStimulus: undefined,
      stimulus: undefined,
    },
    windowEvents: [],
    timedOut: false,
    helpButtonClickedCount: 0,
    parameters: {},
    correctAnswer: [],
    optionOrders: {},
    questionOrders: {},
    ...overrides,
  };
}

export function makeParticipant(overrides: Partial<ParticipantData> & { participantId?: string } = {}): ParticipantData {
  return {
    participantId: 'p1',
    participantConfigHash: 'config-hash-1',
    sequence: {
      id: 'root',
      orderPath: 'root',
      order: 'fixed',
      components: [],
      skip: [],
    },
    participantIndex: 0,
    answers: {},
    searchParams: {},
    metadata: {
      userAgent: 'test-agent',
      resolution: { width: 1920, height: 1080 },
      language: 'en',
      ip: null,
    },
    completed: false,
    rejected: false,
    participantTags: [],
    stage: 'DEFAULT',
    ...overrides,
  } as ParticipantData;
}

export function makeSequenceAssignment(overrides: Partial<SequenceAssignment> = {}): SequenceAssignment {
  return {
    participantId: 'p1',
    timestamp: 0,
    createdTime: 0,
    rejected: false,
    claimed: false,
    completed: null,
    total: 0,
    answered: [],
    isDynamic: false,
    stage: 'DEFAULT',
    ...overrides,
  };
}
