import { parse as hjsonParse } from 'hjson';
import { initializeApp } from 'firebase/app';
import {
  getDownloadURL, getStorage, ref, uploadBytes,
} from 'firebase/storage';
import {
  CollectionReference, DocumentData, Firestore, collection, doc, enableNetwork, getDoc, getDocs, initializeFirestore, orderBy, query, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { ReCaptchaV3Provider, initializeAppCheck } from '@firebase/app-check';
import { getAuth, signInAnonymously, User } from '@firebase/auth';
import localforage from 'localforage';
import { StorageEngine } from './StorageEngine';
import { ParticipantData } from '../types';
import {
  EventType, Sequence, StoredAnswer, TrrackedProvenance,
} from '../../store/types';
import { hash } from './utils';
import { StudyConfig } from '../../parser/types';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';

export interface StoredUser {
  email:string,
  uid:string|null,
}

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

  async initializeParticipantSession(searchParams: Record<string, string>, config: StudyConfig, urlParticipantId?: string) {
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
    };
    await setDoc(participantDoc, participantData);

    return participantData;
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

  async nextParticipant(config: StudyConfig): Promise<ParticipantData> {
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

    // Get the participantData
    const participantData = await this.getParticipantData();
    if (!participantData) {
      throw new Error('Participant not initialized');
    }

    // Loop over the sequence and check if all answers are present
    const allAnswersPresent = getSequenceFlatMap(participantData.sequence).every((step, idx) => {
      if (step === 'end') {
        return true;
      }
      return participantData.answers[`${step}_${idx}`] !== undefined;
    });

    return allAnswersPresent;
  }

  async getUserManagementData(key:string) {
    // Get the user-management collection in Firestore
    const userManagementCollection = collection(this.firestore, 'user-management');
    // Grabs all user-management data and returns data based on key
    const userManagementDocs = await getDocs(userManagementCollection)
      .then((querySnapshot) => {
        const docsObject: Record<string, DocumentData> = {};
        querySnapshot.docs.forEach((queryDoc) => {
          docsObject[queryDoc.id] = queryDoc.data();
        });
        return docsObject;
      });
    if (key in userManagementDocs) {
      return userManagementDocs[key];
    }
    return null;
  }

  async editUserManagementAdmins(adminUsersList: Array<string>, currentUser: User) {
    const firebaseAdminUsers = await this.getUserManagementData('adminUsers');
    const newAdminUsersWithUUids: Array<StoredUser> = [];

    if (firebaseAdminUsers) {
      const firebaseAdminUsersObject: Record<string, string|null> = {};
      firebaseAdminUsers?.adminUsersList.forEach((storedUser:StoredUser) => {
        firebaseAdminUsersObject[storedUser.email] = storedUser.uid;
      });
      adminUsersList.forEach((adminUser) => {
        let newUid:string|null;
        if (adminUser in firebaseAdminUsersObject) {
          const storedUid = firebaseAdminUsersObject[adminUser];
          newUid = storedUid || (currentUser.email === adminUser ? currentUser.uid : null);
        } else {
          newUid = currentUser.email === adminUser ? currentUser.uid : null;
        }
        newAdminUsersWithUUids.push({
          email: adminUser,
          uid: newUid,
        });
      });
    } else {
      // Adds all initial admins on sign in of one of them.
      let newUid:string|null;
      adminUsersList.forEach((adminUser) => {
        newUid = currentUser.email === adminUser ? currentUser.uid : null;
        newAdminUsersWithUUids.push({
          email: adminUser,
          uid: newUid,
        });
      });
    }
    return await setDoc(doc(this.firestore, 'user-management', 'adminUsers'), {
      adminUsersList: newAdminUsersWithUUids,
    });
  }

  // Validates if a user is an admin.
  async validateUserAdminStatus(user: User | null, globalConfigAdminUsers: Array<string>) {
    // There are two cases
    // Case 1: Verify a user when there already exists a database
    // Case 2: Verify a user when there does not exist a database
    if (user) {
      // Case 1: Database exists
      const adminUsers = await this.getUserManagementData('adminUsers');

      if (adminUsers && adminUsers.adminUsersList) {
        const adminUsersObject: Record<string, string|null> = {};
        adminUsers?.adminUsersList.forEach((storedUser:StoredUser) => {
          adminUsersObject[storedUser.email] = storedUser.uid;
        });

        const isAdmin = user.email && (adminUsersObject[user.email] === user.uid || adminUsersObject[user.email] === null);
        if (isAdmin) {
          await this.editUserManagementAdmins(globalConfigAdminUsers, user);
          return true;
        }
        return false;
      // Case 2: Database does not yet exist. First opening
      }
      // Need to get Global config users
      const isAdmin = (user.email?.includes && globalConfigAdminUsers.includes(user.email)) ?? false;
      if (isAdmin) {
        await this.editUserManagementAdmins(globalConfigAdminUsers, user);
        return true;
      }
      return false;
    }
    return false;
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
