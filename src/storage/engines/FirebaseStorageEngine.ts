import { parse as hjsonParse } from 'hjson';
import { initializeApp } from 'firebase/app';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  listAll,
  FirebaseStorage,
  StorageReference,
} from 'firebase/storage';
import {
  CollectionReference,
  DocumentData,
  Firestore,
  collection,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
  initializeFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  deleteDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { ReCaptchaV3Provider, initializeAppCheck } from '@firebase/app-check';
import { getAuth, signInAnonymously } from '@firebase/auth';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import {
  StorageEngine,
  UserWrapped,
  StoredUser,
  REVISIT_MODE,
} from './StorageEngine';
import { ParticipantData } from '../types';
import { ParticipantMetadata, Sequence, StoredAnswer } from '../../store/types';
import { RevisitNotification } from '../../utils/notifications';
import { hash } from './utils';
import { StudyConfig } from '../../parser/types';

export interface FirebaseError {
  title: string;
  message: string;
  details?: string;
}

// Success response always has list of notifications which are then presented to user. Notifications can contain pieces which are individual errors from upstream functions.
interface FirebaseActionResponseSuccess {
  status: 'SUCCESS';
  error?: undefined;
  notifications?: RevisitNotification[];
}

// Failed responses never take notifications, only report error. Notifications will be handled in downstream functions.
interface FirebaseActionResponseFailed {
  status: 'FAILED';
  error: FirebaseError;
  notifications?: undefined;
}

export type FirebaseActionResponse =
  | FirebaseActionResponseSuccess
  | FirebaseActionResponseFailed;

export interface SnapshotNameItem {
  originalName: string;
  alternateName: string;
}

type FirebaseStorageObjectType = 'sequenceArray' | 'participantData' | 'config';
type FirebaseStorageObject<T extends FirebaseStorageObjectType> =
  T extends 'sequenceArray'
    ? Sequence[] | object
    : T extends 'participantData'
    ? ParticipantData | object
    : T extends 'config'
    ? StudyConfig | object
    : never;

function isParticipantData(obj: unknown): obj is ParticipantData {
  const potentialParticipantData = obj as ParticipantData;
  return potentialParticipantData.participantId !== undefined;
}

export class FirebaseStorageEngine extends StorageEngine {
  private RECAPTCHAV3TOKEN = import.meta.env.VITE_RECAPTCHAV3TOKEN;

  private firestore: Firestore;

  private collectionPrefix = import.meta.env.DEV ? 'dev-' : 'prod-';

  private studyCollection:
    | CollectionReference<DocumentData, DocumentData>
    | undefined = undefined;

  private storage: FirebaseStorage;

  private studyId = '';

  // localForage instance for storing currentParticipantId
  private localForage = localforage.createInstance({
    name: 'currentParticipantId',
  });

  private participantData: ParticipantData | null = null;

  constructor() {
    super('firebase');

    const firebaseConfig = hjsonParse(import.meta.env.VITE_FIREBASE_CONFIG);
    const firebaseApp = initializeApp(firebaseConfig);
    this.firestore = initializeFirestore(firebaseApp, {});
    this.storage = getStorage();

    // Check if we're in dev, if so use a debug token
    if (import.meta.env.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    try {
      initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(this.RECAPTCHAV3TOKEN),
        isTokenAutoRefreshEnabled: false,
      });
    } catch (e) {
      console.warn('Failed to initialize Firebase App Check');
    }
  }

  async connect() {
    try {
      await enableNetwork(this.firestore);

      this.connected = true;
    } catch (e) {
      console.warn('Failed to connect to Firebase');
    }
  }

  async initializeStudyDb(studyId: string, config: StudyConfig) {
    try {
      const auth = getAuth();
      if (!auth.currentUser) {
        await signInAnonymously(auth);
        if (!auth.currentUser) throw new Error('Login failed with firebase');
      }

      // Create or retrieve database for study
      this.studyCollection = collection(
        this.firestore,
        `${this.collectionPrefix}${studyId}`,
      );
      this.studyId = studyId;

      const currentConfigHash = await this.getCurrentConfigHash();
      // Hash the config
      const configHash = await hash(JSON.stringify(config));

      // Push the config ref in storage
      await this._pushToFirebaseStorage(
        `configs/${configHash}`,
        'config',
        config,
      );

      // Clear sequence array and current participant data if the config has changed
      if (currentConfigHash && currentConfigHash !== configHash) {
        try {
          await this._deleteFromFirebaseStorage('', 'sequenceArray');
        } catch (error) {
          // pass, if this happens, we didn't have a sequence array yet
        }
        await this.clearCurrentParticipantId();
      }

      await this.setcurrentConfigHash(configHash);

      return Promise.resolve();
    } catch (error) {
      console.warn('Failed to connect to Firebase.');
      return Promise.reject(error);
    }
  }

  async initializeParticipantSession(
    studyId: string,
    searchParams: Record<string, string>,
    config: StudyConfig,
    metadata: ParticipantMetadata,
    urlParticipantId?: string,
  ) {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    // Ensure that we have a participantId
    await this.getCurrentParticipantId(urlParticipantId);
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Check if the participant has already been initialized
    const participant = await this._getFromFirebaseStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
    );

    // Get modes
    const modes = await this.getModes(studyId);

    if (isParticipantData(participant)) {
      // Participant already initialized
      this.participantData = participant;
      return participant;
    }
    // Initialize participant
    const participantConfigHash = await hash(JSON.stringify(config));
    this.participantData = {
      participantId: this.currentParticipantId,
      participantConfigHash,
      sequence: await this.getSequence(),
      answers: {},
      searchParams,
      metadata,
      completed: false,
      rejected: false,
    };

    if (modes.dataCollectionEnabled) {
      await this._pushToFirebaseStorage(
        `participants/${this.currentParticipantId}`,
        'participantData',
        this.participantData,
      );
    }

    return this.participantData;
  }

  async getCurrentConfigHash() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }
    const configHashDoc = doc(
      this.studyCollection,
      'configHash',
    );
    const configHashDocData = await getDoc(configHashDoc);
    return configHashDocData.exists() ? configHashDocData.data().configHash : null;
  }

  async setcurrentConfigHash(configHash: string) {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }
    const configHashDoc = doc(
      this.studyCollection,
      'configHash',
    );
    await setDoc(configHashDoc, { configHash });
  }

  async getAllConfigsFromHash(tempHashes: string[], studyId: string) {
    const allConfigs = tempHashes.map((singleHash) => {
      const participantRef = ref(
        this.storage,
        `${this.collectionPrefix}${studyId}/configs/${singleHash}_config`,
      );
      return this._getFromFirebaseStorageByRef(participantRef, 'config');
    });
    const configs = (await Promise.all(allConfigs)) as StudyConfig[];

    const obj: Record<string, StudyConfig> = {};

    // eslint-disable-next-line no-return-assign
    tempHashes.forEach((singleHash, i) => (obj[singleHash] = configs[i]));

    return obj;
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
    if (!this._verifyStudyDatabase(this.studyCollection)) {
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

  async clearCurrentParticipantId() {
    return await this.localForage.removeItem('currentParticipantId');
  }

  async saveAnswers(answers: Record<string, StoredAnswer>) {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    if (!this.currentParticipantId || this.participantData === null) {
      throw new Error('Participant not initialized');
    }

    // Update the local copy of the participant data
    this.participantData = {
      ...this.participantData,
      answers,
    };

    // Push the updated participant data to Firebase
    await this._pushToFirebaseStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
      this.participantData,
    );
  }

  async setSequenceArray(latinSquare: Sequence[]) {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    await this._pushToFirebaseStorage('', 'sequenceArray', latinSquare);
  }

  async getSequenceArray() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    const sequenceArrayDocData = await this._getFromFirebaseStorage(
      '',
      'sequenceArray',
    );

    return Array.isArray(sequenceArrayDocData) ? sequenceArrayDocData : null;
  }

  async getSequence() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Get the latin square
    const sequenceArray: Sequence[] | null = await this.getSequenceArray();
    if (!sequenceArray) {
      throw new Error('Latin square not initialized');
    }

    // Get modes
    const modes = await this.getModes(this.studyId);

    // Note intent to get a sequence in the sequenceAssignment collection
    const sequenceAssignmentDoc = doc(
      this.studyCollection,
      'sequenceAssignment',
    );
    // Initializes document
    await setDoc(sequenceAssignmentDoc, {});
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );
    const participantSequenceAssignmentDoc = doc(
      sequenceAssignmentCollection,
      this.currentParticipantId,
    );

    const rejectedQuery = query(
      sequenceAssignmentCollection,
      where('participantId', '==', ''),
    );
    const rejectedDocs = await getDocs(rejectedQuery);
    if (rejectedDocs.docs.length > 0) {
      const firstReject = rejectedDocs.docs[0];
      const firstRejectTime = firstReject.data().timestamp;
      if (modes.dataCollectionEnabled) {
        await deleteDoc(firstReject.ref);
        await setDoc(participantSequenceAssignmentDoc, {
          participantId: this.currentParticipantId,
          timestamp: firstRejectTime,
        });
      }
    } else if (modes.dataCollectionEnabled) {
      await setDoc(participantSequenceAssignmentDoc, {
        participantId: this.currentParticipantId,
        timestamp: serverTimestamp(),
      });
    }

    // Query all the intents to get a sequence and find our position in the queue
    const intentsQuery = query(
      sequenceAssignmentCollection,
      orderBy('timestamp', 'asc'),
    );
    const intentDocs = await getDocs(intentsQuery);
    const intents = intentDocs.docs.map((intent) => intent.data());

    // Get the current row
    const intentIndex = intents.findIndex(
      (intent) => intent.participantId === this.currentParticipantId,
    ) % sequenceArray.length;
    const selectedIndex = intentIndex === -1
      ? Math.floor(Math.random() * sequenceArray.length - 1)
      : intentIndex;
    const currentRow = sequenceArray[selectedIndex];

    if (!currentRow) {
      throw new Error('Latin square is empty');
    }

    return currentRow;
  }

  async getAllParticipantsData() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    // Get all participants
    const participantRefs = ref(
      this.storage,
      `${this.collectionPrefix}${this.studyId}/participants`,
    );
    const participants = await listAll(participantRefs);
    const participantsData: ParticipantData[] = [];

    const participantPulls = participants.items.map(async (participant) => {
      const participantData = await this._getFromFirebaseStorageByRef(
        participant,
        'participantData',
      );

      if (isParticipantData(participantData)) {
        participantsData.push(participantData);
      }
    });

    await Promise.all(participantPulls);

    return participantsData;
  }

  async getParticipantData() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    if (this.currentParticipantId === null) {
      throw new Error('Participant not initialized');
    }

    const participantData = await this._getFromFirebaseStorage(
      `participants/${this.currentParticipantId}`,
      'participantData',
    );

    return isParticipantData(participantData) ? participantData : null;
  }

  async nextParticipant() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    // Generate a new participant id
    const newParticipantId = uuidv4();

    // Set current participant id
    await this.localForage.setItem('currentParticipantId', newParticipantId);
  }

  async verifyCompletion() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Get the participantData
    await this.getParticipantData();
    if (!this.participantData) {
      throw new Error('Participant not initialized');
    }

    // Get modes
    const modes = await this.getModes(this.studyId);

    this.participantData.completed = true;
    if (modes.dataCollectionEnabled) {
      await this._pushToFirebaseStorage(
        `participants/${this.currentParticipantId}`,
        'participantData',
        this.participantData,
      );
    }

    return true;
  }

  // Gets data from the user-management collection based on the inputted string
  async getUserManagementData(key: string) {
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
    if (key in docsObject) {
      return docsObject[key];
    }
    return null;
  }

  async validateUser(user: UserWrapped | null) {
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
              await setDoc(
                doc(this.firestore, 'user-management', 'adminUsers'),
                {
                  adminUsersList: adminUsers.adminUsersList,
                },
              );
            }
            return true;
          }
          return false;
        }
      }
      return true;
    }
    return false;
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

  async getAllParticipantsDataByStudy(studyId: string) {
    const currentStorageRef = ref(
      this.storage,
      `${this.collectionPrefix}${studyId}/participants`,
    );

    // Get all participants
    const participants = await listAll(currentStorageRef);
    const participantsData: ParticipantData[] = [];

    const participantPulls = participants.items.map(async (participant) => {
      const participantData = await this._getFromFirebaseStorageByRef(
        participant,
        'participantData',
      );

      if (isParticipantData(participantData)) {
        participantsData.push(participantData);
      }
    });

    await Promise.all(participantPulls);

    return participantsData;
  }

  async rejectParticipant(studyId: string, participantId: string) {
    const studyCollection = collection(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
    );
    const participantRef = ref(
      this.storage,
      `${this.collectionPrefix}${studyId}/participants/${participantId}_participantData`,
    );
    const participant = await this._getFromFirebaseStorageByRef(
      participantRef,
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
      participant.rejected = true;
      await this._pushToFirebaseStorageByRef(
        participantRef,
        'participantData',
        participant,
      );

      // set sequence assignment to empty string, keep the timestamp
      const sequenceAssignmentDoc = doc(studyCollection, 'sequenceAssignment');
      const sequenceAssignmentCollection = collection(
        sequenceAssignmentDoc,
        'sequenceAssignment',
      );
      const participantSequenceAssignmentDoc = doc(
        sequenceAssignmentCollection,
        participantId,
      );
      await updateDoc(participantSequenceAssignmentDoc, { participantId: '' });
    } catch {
      console.warn('Failed to reject the participant.');
    }
  }

  async setMode(studyId: string, mode: REVISIT_MODE, value: boolean) {
    const revisitModesDoc = doc(
      this.firestore,
      'metadata',
      `${this.collectionPrefix}${studyId}`,
    );

    return await setDoc(revisitModesDoc, { [mode]: value }, { merge: true });
  }

  async getModes(studyId: string) {
    const revisitModesDoc = doc(
      this.firestore,
      'metadata',
      `${this.collectionPrefix}${studyId}`,
    );
    const revisitModesSnapshot = await getDoc(revisitModesDoc);

    if (revisitModesSnapshot.exists()) {
      return revisitModesSnapshot.data() as Record<REVISIT_MODE, boolean>;
    }

    // Else set to default values
    const defaultModes = {
      dataCollectionEnabled: true,
      studyNavigatorEnabled: true,
      analyticsInterfacePubliclyAccessible: true,
    };
    await setDoc(revisitModesDoc, defaultModes);
    return defaultModes;
  }

  async createSnapshot(
    studyId: string,
    deleteData: boolean,
  ): Promise<FirebaseActionResponse> {
    const sourceName = `${this.collectionPrefix}${studyId}`;

    if (!(await this._directoryExists(sourceName))) {
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

    await this._copyDirectory(`${sourceName}/configs`, `${targetName}/configs`);
    await this._copyDirectory(
      `${sourceName}/participants`,
      `${targetName}/participants`,
    );
    await this._copyDirectory(sourceName, targetName);
    await this._copyCollection(sourceName, targetName);
    await this._addDirectoryNameToMetadata(targetName);

    const createSnapshotSuccessNotifications: RevisitNotification[] = [];
    if (deleteData) {
      const removeSnapshotResponse = await this.removeSnapshotOrLive(
        sourceName,
        false,
      );
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

  async removeSnapshotOrLive(
    targetName: string,
    includeMetadata: boolean,
  ): Promise<FirebaseActionResponse> {
    try {
      const targetNameWithPrefix = targetName.startsWith(this.collectionPrefix)
        ? targetName
        : `${this.collectionPrefix}${targetName}`;

      await this._deleteDirectory(`${targetNameWithPrefix}/configs`);
      await this._deleteDirectory(`${targetNameWithPrefix}/participants`);
      await this._deleteDirectory(targetNameWithPrefix);
      await this._deleteCollection(targetNameWithPrefix);

      if (includeMetadata) {
        await this._removeNameFromMetadata(targetNameWithPrefix);
      }
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
    } catch (error) {
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

  async getSnapshots(studyId: string) {
    try {
      const metadataDoc = doc(this.firestore, 'metadata', 'collections');
      const metadataSnapshot = await getDoc(metadataDoc);

      if (metadataSnapshot.exists()) {
        const collections = metadataSnapshot.data();
        const matchingCollections = Object.keys(collections)
          .filter((directoryName) => directoryName.startsWith(
            `${this.collectionPrefix}${studyId}-snapshot`,
          ))
          .map((directoryName) => {
            const value = collections[directoryName];
            let transformedValue;
            if (typeof value === 'boolean') {
              transformedValue = directoryName;
            } else if (
              value
              && typeof value === 'object'
              && value.enabled === true
            ) {
              transformedValue = value.name;
            } else {
              transformedValue = null;
            }
            return {
              originalName: directoryName,
              alternateName: transformedValue,
            };
          })
          .filter((item) => item.alternateName !== null);
        const sortedCollections = matchingCollections
          .sort((a, b) => a.originalName.localeCompare(b.originalName))
          .reverse(); // Reverse the sorted array if needed
        return sortedCollections;
      }
      return [];
    } catch (error) {
      console.error('Error listing collections with prefix:', error);
      throw error;
    }
  }

  async restoreSnapshot(
    studyId: string,
    snapshotName: string,
  ): Promise<FirebaseActionResponse> {
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
      await this._copyDirectory(snapshotName, originalName);
      await this._copyCollection(snapshotName, originalName);
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

  // Function to add collection name to metadata
  async _addDirectoryNameToMetadata(directoryName: string) {
    try {
      const metadataDoc = doc(this.firestore, 'metadata', 'collections');
      await setDoc(
        metadataDoc,
        { [directoryName]: { enabled: true, name: directoryName } },
        { merge: true },
      );
    } catch (error) {
      console.error('Error adding collection to metadata:', error);
      throw error;
    }
  }

  async renameSnapshot(
    directoryName: string,
    newName: string,
  ): Promise<FirebaseActionResponse> {
    try {
      const metadataDoc = doc(this.firestore, 'metadata', 'collections');
      await setDoc(
        metadataDoc,
        { [directoryName]: { enabled: true, name: newName } },
        { merge: true },
      );
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

  async _removeNameFromMetadata(directoryName: string) {
    try {
      const metadataDoc = doc(this.firestore, 'metadata', 'collections');
      const metadataSnapshot = await getDoc(metadataDoc);

      if (metadataSnapshot.exists()) {
        const metadata = metadataSnapshot.data();
        if (metadata[directoryName]) {
          delete metadata[directoryName];
          await setDoc(metadataDoc, metadata);
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

  async _deleteDirectory(directoryPath: string) {
    try {
      const directoryRef = ref(this.storage, directoryPath);
      const directorySnapshot = await listAll(directoryRef);

      const deletePromises = directorySnapshot.items.map((fileRef) => deleteObject(fileRef));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting files in directory:', error);
    }
  }

  async _copyDirectory(sourceDir: string, targetDir: string) {
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

  async _copyFile(sourceFilePath: string, targetFilePath: string) {
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

  async _copyCollection(
    sourceCollectionName: string,
    targetCollectionName: string,
  ) {
    const sourceCollectionRef = collection(
      this.firestore,
      sourceCollectionName,
    );
    const sourceSequenceAssignmentDocRef = doc(
      sourceCollectionRef,
      'sequenceAssignment',
    );
    const sourceSequenceAssignmentCollectionRef = collection(
      sourceSequenceAssignmentDocRef,
      'sequenceAssignment',
    );

    const targetCollectionRef = collection(
      this.firestore,
      targetCollectionName,
    );
    const targetSequenceAssignmentDocRef = doc(
      targetCollectionRef,
      'sequenceAssignment',
    );
    await setDoc(targetSequenceAssignmentDocRef, {});
    const targetSequenceAssignmentCollectionRef = collection(
      targetSequenceAssignmentDocRef,
      'sequenceAssignment',
    );

    const sourceSnapshot = await getDocs(sourceSequenceAssignmentCollectionRef);

    const batch = writeBatch(this.firestore);

    sourceSnapshot.docs.forEach((docSnapshot) => {
      const targetDocRef = doc(
        targetSequenceAssignmentCollectionRef,
        docSnapshot.id,
      );

      batch.set(targetDocRef, docSnapshot.data());
    });

    await batch.commit();
  }

  async _deleteCollection(sourceCollectionName: string) {
    const sourceCollectionRef = collection(
      this.firestore,
      sourceCollectionName,
    );
    const sourceSequenceAssignmentDocRef = doc(
      sourceCollectionRef,
      'sequenceAssignment',
    );
    const sourceSequenceAssignmentCollectionRef = collection(
      sourceSequenceAssignmentDocRef,
      'sequenceAssignment',
    );

    const collectionSnapshot = await getDocs(
      sourceSequenceAssignmentCollectionRef,
    );

    const batch = writeBatch(this.firestore);
    collectionSnapshot.forEach((docSnapshot) => {
      const docRef = doc(sourceSequenceAssignmentCollectionRef, docSnapshot.id);
      batch.delete(docRef);
    });
    batch.delete(sourceSequenceAssignmentDocRef);

    await batch.commit();
  }

  async _directoryExists(directoryPath: string) {
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

  private _verifyStudyDatabase(
    db: CollectionReference<DocumentData, DocumentData> | undefined,
  ): db is CollectionReference<DocumentData, DocumentData> {
    return db !== undefined;
  }

  // Firebase storage helpers
  private async _getFromFirebaseStorage<T extends FirebaseStorageObjectType>(
    prefix: string,
    type: T,
  ) {
    const storageRef = ref(
      this.storage,
      `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`,
    );

    let storageObj: FirebaseStorageObject<T> = {} as FirebaseStorageObject<T>;
    try {
      const url = await getDownloadURL(storageRef);
      const response = await fetch(url);
      const fullProvStr = await response.text();
      storageObj = JSON.parse(fullProvStr);
    } catch {
      console.warn(
        `${prefix} does not have ${type} for ${this.collectionPrefix}${this.studyId}.`,
      );
    }

    return storageObj;
  }

  private async _getFromFirebaseStorageByRef<
    T extends FirebaseStorageObjectType
  >(storageRef: StorageReference, type: T) {
    let storageObj: FirebaseStorageObject<T> = {} as FirebaseStorageObject<T>;

    try {
      const url = await getDownloadURL(storageRef);
      const response = await fetch(url);
      const fullProvStr = await response.text();
      storageObj = JSON.parse(fullProvStr);
    } catch {
      console.warn(`${storageRef} with type ${type} not found.`);
    }

    return storageObj;
  }

  private async _pushToFirebaseStorage<T extends FirebaseStorageObjectType>(
    prefix: string,
    type: T,
    objectToUpload: FirebaseStorageObject<T>,
  ) {
    if (Object.keys(objectToUpload).length > 0) {
      const storageRef = ref(
        this.storage,
        `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`,
      );
      const blob = new Blob([JSON.stringify(objectToUpload)], {
        type: 'application/json',
      });
      await uploadBytes(storageRef, blob);
    }
  }

  private async _pushToFirebaseStorageByRef<
    T extends FirebaseStorageObjectType
  >(
    storageRef: StorageReference,
    type: T,
    objectToUpload: FirebaseStorageObject<T>,
  ) {
    if (Object.keys(objectToUpload).length > 0) {
      const blob = new Blob([JSON.stringify(objectToUpload)], {
        type: 'application/json',
      });
      await uploadBytes(storageRef, blob);
    }
  }

  private async _deleteFromFirebaseStorage<T extends 'sequenceArray'>(
    prefix: string,
    type: T,
  ) {
    const storageRef = ref(
      this.storage,
      `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`,
    );
    await deleteObject(storageRef);
  }
}
