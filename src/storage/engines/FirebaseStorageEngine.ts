import { parse as hjsonParse } from 'hjson';
import { initializeApp } from 'firebase/app';
import {
  getDownloadURL, getStorage, ref, uploadBytes,
} from 'firebase/storage';
import {
  CollectionReference, DocumentData, Firestore, collection, doc, enableNetwork, getDoc, getDocs, initializeFirestore, orderBy, query, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { ReCaptchaV3Provider, initializeAppCheck } from '@firebase/app-check';
import { getAuth, signInAnonymously } from '@firebase/auth';
import localforage from 'localforage';
import { StorageEngine, UserWrapped, StoredUser } from './StorageEngine';
import { ParticipantData } from '../types';
import {
  EventType, ParticipantMetadata, Sequence, StoredAnswer, TrrackedProvenance,
} from '../../store/types';
import { hash } from './utils';
import { StudyConfig } from '../../parser/types';

export class FirebaseStorageEngine extends StorageEngine {
  private RECAPTCHAV3TOKEN = import.meta.env.VITE_RECAPTCHAV3TOKEN;

  private firestore: Firestore;

  private collectionPrefix = import.meta.env.DEV ? 'dev-' : 'prod-';

  private studyCollection: CollectionReference<DocumentData, DocumentData> | undefined = undefined;

  private studyId = '';

  // localForage instance for storing currentParticipantId
  private localForage = localforage.createInstance({ name: 'currentParticipantId' });

  private localProvenanceCopy: Record<string, TrrackedProvenance> = {};

  private localWindowEvents: Record<string, EventType[]> = {};

  constructor() {
    super('firebase');

    const firebaseConfig = hjsonParse(import.meta.env.VITE_FIREBASE_CONFIG);
    const firebaseApp = initializeApp(firebaseConfig);
    this.firestore = initializeFirestore(firebaseApp, {});

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

      // Check the connection to the database
      const connectedRef = await doc(this.firestore, '.info/connected');
      await getDoc(connectedRef);

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

      // Hash the config
      const configHash = await hash(JSON.stringify(config));

      await this.localForage.setItem('currentConfigHash', configHash);

      // Create or retrieve database for study
      this.studyCollection = collection(this.firestore, `${this.collectionPrefix}${studyId}`);
      this.studyId = studyId;
      const configsDoc = doc(this.studyCollection, 'configs');
      const configsCollection = collection(configsDoc, 'configs');
      const configDoc = doc(configsCollection, configHash);

      return await setDoc(configDoc, config);
    } catch (error) {
      console.warn('Failed to connect to Firebase.');
      return Promise.reject(error);
    }
  }

  async initializeParticipantSession(searchParams: Record<string, string>, config: StudyConfig, metadata: ParticipantMetadata, urlParticipantId?: string) {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    // Ensure that we have a participantId
    await this.getCurrentParticipantId(urlParticipantId);
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Check if the participant has already been initialized
    const participantDoc = doc(this.studyCollection, this.currentParticipantId);
    const participant = (await getDoc(participantDoc)).data() as ParticipantData | null;

    // Restore localProvenanceCopy
    this.localProvenanceCopy = await this._getFromFirebaseStorage(this.currentParticipantId, 'provenance');

    // Restore localWindowEvents
    this.localWindowEvents = await this._getFromFirebaseStorage(this.currentParticipantId, 'windowEvents');
    Object.entries(this.localWindowEvents).forEach(([step, events]) => {
      if (participant === null) return;

      if (events === undefined || events.length === 0) {
        participant.answers[step].windowEvents = [];
      } else {
        participant.answers[step].windowEvents = events;
      }
    });

    if (participant) {
      // Participant already initialized
      return participant;
    }
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
    };
    await setDoc(participantDoc, participantData);

    return participantData;
  }

  async getCurrentConfigHash() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    return await this.localForage.getItem('currentConfigHash') as string;
  }

  async getCurrentParticipantId(urlParticipantId?: string) {
    // Get currentParticipantId from localForage
    const currentParticipantId = await this.localForage.getItem('currentParticipantId');

    // Prioritize urlParticipantId, then currentParticipantId, then generate a new participantId
    if (urlParticipantId) {
      this.currentParticipantId = urlParticipantId;
      await this.localForage.setItem('currentParticipantId', urlParticipantId);
      return urlParticipantId;
    } if (currentParticipantId) {
      this.currentParticipantId = currentParticipantId as string;
      return currentParticipantId as string;
    }
    // Create new participant doc inside study collection and get the currentParticipantId from that new participant
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    // Generate new participant id
    const participantDoc = doc(this.studyCollection);
    this.currentParticipantId = participantDoc.id;

    // Set currentParticipantId in localForage
    await this.localForage.setItem('currentParticipantId', this.currentParticipantId);

    return this.currentParticipantId;
  }

  async clearCurrentParticipantId() {
    return await this.localForage.removeItem('currentParticipantId');
  }

  async saveAnswer(identifier: string, answer: StoredAnswer) {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Get the participant doc
    const participantDoc = doc(this.studyCollection, this.currentParticipantId);

    const answerToSave = {
      answer: answer.answer,
      startTime: answer.startTime,
      endTime: answer.endTime,
    };

    await setDoc(participantDoc, { answers: { [identifier]: answerToSave } }, { merge: true });

    if (answer.provenanceGraph) {
      this.localProvenanceCopy[identifier] = answer.provenanceGraph;
      await this._pushToFirebaseStorage(this.currentParticipantId, 'provenance', this.localProvenanceCopy);
    }

    this.localWindowEvents[identifier] = answer.windowEvents;
    await this._pushToFirebaseStorage(this.currentParticipantId, 'windowEvents', this.localWindowEvents);
  }

  async setSequenceArray(latinSquare: Sequence[]) {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    this._pushToFirebaseStorage('', 'sequenceArray', { sequenceArray: latinSquare });
  }

  async getSequenceArray() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    const sequenceArrayDocData = await this._getFromFirebaseStorage('', 'sequenceArray');

    return sequenceArrayDocData.sequenceArray;
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

    // Note intent to get a sequence in the sequenceAssignment collection
    const sequenceAssignmentDoc = doc(this.studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(sequenceAssignmentDoc, 'sequenceAssignment');
    const participantSequenceAssignmentDoc = doc(sequenceAssignmentCollection, this.currentParticipantId);
    await setDoc(participantSequenceAssignmentDoc, { participantId: this.currentParticipantId, timestamp: serverTimestamp() });

    // Query all the intents to get a sequence and find our position in the queue
    const intentsQuery = query(sequenceAssignmentCollection, orderBy('timestamp', 'asc'));
    const intentDocs = await getDocs(intentsQuery);
    const intents = intentDocs.docs.map((intent) => intent.data());

    // Get the current row
    const intentIndex = intents.findIndex((intent) => intent.participantId === this.currentParticipantId);
    const currentRow = sequenceArray[intentIndex % sequenceArray.length];

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
    const participants = await getDocs(this.studyCollection);
    const participantData: ParticipantData[] = [];

    // Iterate over the participants and add the provenance graph
    const participantPulls = participants.docs.map(async (participant) => {
      // Exclude the config doc and the sequenceArray doc
      if (participant.id === 'config' || participant.id === 'sequenceArray') return;

      const participantDataItem = participant.data() as ParticipantData;

      const fullProvObj = await this._getFromFirebaseStorage(participantDataItem.participantId, 'provenance');
      const fullWindowEventsObj = await this._getFromFirebaseStorage(participantDataItem.participantId, 'windowEvents');

      // Rehydrate the provenance graphs
      participantDataItem.answers = Object.fromEntries(Object.entries(participantDataItem.answers).map(([key, value]) => {
        if (value === undefined) return [key, value];
        const provenanceGraph = fullProvObj[key];
        const windowEvents = fullWindowEventsObj[key];
        return [key, { ...value, provenanceGraph, windowEvents }];
      }));
      participantData.push(participantDataItem);
    });

    await Promise.all(participantPulls);

    return participantData;
  }

  async getParticipantData() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    // Ensure we have currentParticipantId
    await this.getCurrentParticipantId();

    // Get participant data
    let participant: ParticipantData | null = null;
    if (this.currentParticipantId !== null) {
      const participantDoc = doc(this.studyCollection, this.currentParticipantId);
      participant = (await getDoc(participantDoc)).data() as ParticipantData | null;

      // Get provenance data
      if (participant !== null) {
        const fullProvObj = await this._getFromFirebaseStorage(this.currentParticipantId, 'provenance');
        const fullWindowEventsObj = await this._getFromFirebaseStorage(this.currentParticipantId, 'windowEvents');

        // Iterate over the participant answers and add the provenance graph
        Object.entries(participant.answers).forEach(([step, answer]) => {
          if (answer === undefined) return;
          answer.provenanceGraph = fullProvObj[step];
          answer.windowEvents = fullWindowEventsObj[step];
        });
      }
    }

    return participant;
  }

  async nextParticipant(config: StudyConfig, metadata: ParticipantMetadata): Promise<ParticipantData> {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    // Generate a new participant id
    const newParticipant = doc(this.studyCollection);
    const newParticipantId = newParticipant.id;

    // Set current participant id
    await this.localForage.setItem('currentParticipantId', newParticipantId);
    this.currentParticipantId = newParticipantId;

    // Get participant data
    let participant: ParticipantData | null = null;
    if (this.currentParticipantId !== null) {
      participant = (await getDoc(newParticipant)).data() as ParticipantData | null;
    }

    if (!participant) {
      const participantConfigHash = await hash(JSON.stringify(config));
      // Generate a new participant
      const newParticipantData: ParticipantData = {
        participantId: newParticipantId,
        participantConfigHash,
        sequence: await this.getSequence(),
        answers: {},
        searchParams: {},
        metadata,
        completed: false,
      };
      await setDoc(newParticipant, newParticipantData);
      participant = newParticipantData;
    }

    return participant;
  }

  async verifyCompletion() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Get the participantData
    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    // Check if all components have been completed
    const participantDoc = doc(this.studyCollection, this.currentParticipantId);
    await setDoc(participantDoc, { completed: true }, { merge: true });

    participantData.completed = true;

    return true;
  }

  // Gets data from the user-management collection based on the inputted string
  async getUserManagementData(key: string) {
    // Get the user-management collection in Firestore
    const userManagementCollection = collection(this.firestore, 'user-management');
    // Grabs all user-management data and returns data based on key
    const querySnapshot = await getDocs(userManagementCollection);
    // Converts querySnapshot data to Object
    const docsObject = Object.fromEntries(querySnapshot.docs.map((queryDoc) => [queryDoc.id, queryDoc.data()]));
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
          const adminUsersObject = Object.fromEntries(adminUsers.adminUsersList.map((storedUser:StoredUser) => [storedUser.email, storedUser.uid]));
          // Verifies that, if the user has signed in and thus their UID is added to the Firestore, that the current UID matches the Firestore entries UID. Prevents impersonation (otherwise, users would be able to alter email to impersonate).
          const isAdmin = user.user.email && (adminUsersObject[user.user.email] === user.user.uid || adminUsersObject[user.user.email] === null);
          if (isAdmin) {
            return true;
          }
          return false;
        }
      }
      return true;
    }
    return false;
  }

  async changeAuth(bool:boolean) {
    await setDoc(doc(this.firestore, 'user-management', 'authentication'), {
      isEnabled: bool,
    });
  }

  async addAdminUser(user: StoredUser) {
    const adminUsers = await this.getUserManagementData('adminUsers');
    if (adminUsers?.adminUsersList) {
      const adminList = adminUsers.adminUsersList;
      const isInList = adminList.find((storedUser: StoredUser) => storedUser.email === user.email);
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

  async removeAdminUser(email:string) {
    const adminUsers = await this.getUserManagementData('adminUsers');
    if (adminUsers?.adminUsersList && adminUsers.adminUsersList.length > 1) {
      if (adminUsers.adminUsersList.find((storedUser: StoredUser) => storedUser.email === email)) {
        adminUsers.adminUsersList = adminUsers?.adminUsersList.filter((storedUser:StoredUser) => storedUser.email !== email);
        await setDoc(doc(this.firestore, 'user-management', 'adminUsers'), {
          adminUsersList: adminUsers?.adminUsersList,
        });
      }
    }
  }

  async getAllParticipantsDataByStudy(studyId:string) {
    const currentCollection = collection(this.firestore, `${this.collectionPrefix}${studyId}`);

    // Get all participants
    const participants = await getDocs(currentCollection);
    const participantData: ParticipantData[] = [];

    // Iterate over the participants and add the provenance graph
    const participantPulls = participants.docs.map(async (participant) => {
      // Exclude the config doc and the sequenceArray doc
      if (participant.id === 'config' || participant.id === 'sequenceArray') return;

      const participantDataItem = participant.data() as ParticipantData;

      const fullProvObj = await this._getFromFirebaseStorage(participantDataItem.participantId, 'provenance');
      const fullWindowEventsObj = await this._getFromFirebaseStorage(participantDataItem.participantId, 'windowEvents');

      // Rehydrate the provenance graphs
      participantDataItem.answers = Object.fromEntries(Object.entries(participantDataItem.answers).map(([key, value]) => {
        if (value === undefined) return [key, value];
        const provenanceGraph = fullProvObj[key];
        const windowEvents = fullWindowEventsObj[key];
        return [key, { ...value, provenanceGraph, windowEvents }];
      }));
      participantData.push(participantDataItem);
    });

    await Promise.all(participantPulls);

    return participantData;
  }

  private _verifyStudyDatabase(db: CollectionReference<DocumentData, DocumentData> | undefined): db is CollectionReference<DocumentData, DocumentData> {
    return db !== undefined;
  }

  // Firebase storage helpers
  private async _getFromFirebaseStorage<T extends 'provenance' | 'windowEvents' | 'sequenceArray'>(prefix: string, type: T) {
    const storage = getStorage();
    const storageRef = ref(storage, `${this.studyId}/${prefix}_${type}`);

    let storageObj: Record<string, T extends 'provenance' ? TrrackedProvenance : T extends 'windowEvents' ? EventType[] : Sequence[]> = {};
    try {
      const url = await getDownloadURL(storageRef);
      const response = await fetch(url);
      const fullProvStr = await response.text();
      storageObj = JSON.parse(fullProvStr);
    } catch {
      console.warn(`${prefix} does not have ${type} for ${this.studyId}.`);
    }

    return storageObj;
  }

  private async _pushToFirebaseStorage<T extends 'provenance' | 'windowEvents' | 'sequenceArray'>(prefix: string, type: T, objectToUpload: Record<string, T extends 'provenance' ? TrrackedProvenance : T extends 'windowEvents' ? EventType[] : Sequence[]> = {}) {
    if (Object.keys(objectToUpload).length > 0) {
      const storage = getStorage();
      const storageRef = ref(storage, `${this.studyId}/${prefix}_${type}`);
      const blob = new Blob([JSON.stringify(objectToUpload)], {
        type: 'application/json',
      });
      await uploadBytes(storageRef, blob);
    }
  }
}
