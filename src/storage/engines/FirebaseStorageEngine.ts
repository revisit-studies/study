import { EventType, StoredAnswer, TrrackedProvenance } from '../../store/types';
import { ParticipantData } from '../types';
import { StorageEngine } from './StorageEngine';
import { parse as hjsonParse } from 'hjson';
import { initializeApp } from 'firebase/app';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { CollectionReference, DocumentData, Firestore, collection, doc, enableNetwork, getDoc, getDocs, initializeFirestore, setDoc } from 'firebase/firestore';
import { ReCaptchaV3Provider, initializeAppCheck } from '@firebase/app-check';
import { getAuth, signInAnonymously } from '@firebase/auth';
import localforage from 'localforage';

export class FirebaseStorageEngine extends StorageEngine {
  private RECAPTCHAV3TOKEN = '6LdjOd0lAAAAAASvFfDZFWgtbzFSS9Y3so8rHJth';
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
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
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
      const auth = getAuth();
      await signInAnonymously(auth);
      if (!auth.currentUser) throw new Error('Login failed with firebase');
      await enableNetwork(this.firestore);

      // Check the connection to the database
      const connectedRef = await doc(this.firestore, '.info/connected');
      await getDoc(connectedRef);

      this.connected = true;
    } catch (e) {
      console.warn('Failed to connect to Firebase');
    }
  }

  async initializeStudyDb(studyId: string, config: object) {
    // Create or retrieve database for study
    this.studyCollection = collection(this.firestore, `${this.collectionPrefix}${studyId}`);
    this.studyId = studyId;
    const configDoc = doc(this.studyCollection, 'config');
    return await setDoc(configDoc, config);
  }

  async initializeParticipantSession(searchParams: Record<string, string>, urlParticipantId?: string) {
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
    } else {
      // Initialize participant
      const participantData: ParticipantData = {
        participantId: this.currentParticipantId,
        sequence: await this.getSequence(),
        answers: {},
        searchParams,
      };
      await setDoc(participantDoc, participantData);

      return participantData;
    }

  }

  async getCurrentParticipantId(urlParticipantId?: string) {
    // Get currentParticipantId from localForage
    const currentParticipantId = await this.localForage.getItem('currentParticipantId');

    // Prioritize urlParticipantId, then currentParticipantId, then generate a new participantId
    if (urlParticipantId) {
      this.currentParticipantId = urlParticipantId;
      await this.localForage.setItem('currentParticipantId', urlParticipantId);
      return urlParticipantId;
    } else if (currentParticipantId) {
      this.currentParticipantId = currentParticipantId as string;
      return currentParticipantId as string;
    } else {
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
  }

  async clearCurrentParticipantId() {
    return await this.localForage.removeItem('currentParticipantId');
  }

  async saveAnswer(currentStep: string, answer: StoredAnswer) {
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

    await setDoc(participantDoc, { answers: { [currentStep]: answerToSave } }, { merge: true });

    if (answer.provenanceGraph) {
      this.localProvenanceCopy[currentStep] = answer.provenanceGraph;
      await this._pushToFirebaseStorage('provenance');
    }

    this.localWindowEvents[currentStep] = answer.windowEvents;
    await this._pushToFirebaseStorage('windowEvents');
  }

  async setSequenceArray(latinSquare: string[][]) {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    // convert the latin square to a firebase-friendly format (nested arrays are not supported)
    const firebaseFriendlyLatinSquare = latinSquare.map((row) => row.join(','));

    const sequenceArrayDoc = doc(this.studyCollection, 'sequenceArray');
    const sequenceArrayDocData = { sequenceArray: firebaseFriendlyLatinSquare };
    return await setDoc(sequenceArrayDoc, sequenceArrayDocData);
  }

  async getSequenceArray() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    const sequenceArrayDoc = doc(this.studyCollection, 'sequenceArray');
    const sequenceArrayDocData = (await getDoc(sequenceArrayDoc)).data() as { sequenceArray: string[] };

    if (sequenceArrayDocData === undefined) {
      return null;
    } else {
      // convert the firebase-friendly format back to a latin square
      return sequenceArrayDocData.sequenceArray.map((row: string) => row.split(','));
    }
  }

  async getSequence() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    // Get the latin square
    const sequenceArray: string[][] | null = await this.getSequenceArray();
    if (!sequenceArray) {
      throw new Error('Latin square not initialized');
    }

    // Get the current row
    const currentRow = sequenceArray.pop();

    if (!currentRow) {
      throw new Error('Latin square is empty');
    }

    // Update the latin square
    await this.setSequenceArray(sequenceArray);

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

  async nextParticipant(): Promise<ParticipantData> {
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
      // Generate a new participant
      const newParticipantData: ParticipantData = {
        participantId: newParticipantId,
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
    const allAnswersPresent = participantData.sequence.every((step) => {
      if (step === 'end') {
        return true;
      }
      return participantData.answers[step] !== undefined;
    });

    return allAnswersPresent;
  }

  private _verifyStudyDatabase(db: CollectionReference<DocumentData, DocumentData> | undefined): db is CollectionReference<DocumentData, DocumentData>  {
    return db !== undefined;
  }

  private async _getFromFirebaseStorage<T extends 'provenance' | 'windowEvents'>(participantId: string, type: T) {
    const storage = getStorage();
    const storageRef = ref(storage, `${this.studyId}/${participantId}_${type}`);

    let storageObj: Record<string, T extends 'provenance' ? TrrackedProvenance : EventType[]> = {};
    try {
      const url = await getDownloadURL(storageRef);
      const response = await fetch(url);
      const fullProvStr = await response.text();
      storageObj = JSON.parse(fullProvStr);
    } catch {
      console.warn(`Participant ${participantId} does not have ${type} for ${this.studyId}.`);
    }

    return storageObj;
  }

  private async _pushToFirebaseStorage<T extends 'provenance' | 'windowEvents'>(type: T) {
    const objectToUpload = type === 'provenance' ? this.localProvenanceCopy : this.localWindowEvents;
  
    if (Object.keys(objectToUpload).length > 0) {
      const storage = getStorage();
      const storageRef = ref(storage, `${this.studyId}/${this.currentParticipantId}_${type}`);
      const blob = new Blob([JSON.stringify(objectToUpload)], {
        type: 'application/json',
      });
      await uploadBytes(storageRef, blob);
    }
  }
}
