import { StoredAnswer, TrrackedProvenance } from '../../store/types';
import { ParticipantData } from '../types';
import { StorageEngine } from './StorageEngine';
import { parse as hjsonParse } from 'hjson';
import { initializeApp } from 'firebase/app';
import { CollectionReference, DocumentData, DocumentReference, Firestore, collection, doc, enableNetwork, getDoc, getDocs, initializeFirestore, setDoc } from 'firebase/firestore';
import { ReCaptchaV3Provider, initializeAppCheck } from '@firebase/app-check';
import { getAuth, signInAnonymously } from '@firebase/auth';
import localforage from 'localforage';

export class FirebaseStorageEngine extends StorageEngine {
  private RECAPTCHAV3TOKEN = '6LdjOd0lAAAAAASvFfDZFWgtbzFSS9Y3so8rHJth';
  private firestore: Firestore;
  private collectionPrefix = import.meta.env.DEV ? 'dev-' : 'prod-';
  private studyCollection: CollectionReference<DocumentData, DocumentData> | undefined = undefined;

  // localForage instance for storing currentParticipantId
  private localForage = localforage.createInstance({ name: 'currentParticipantId' });

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
      enableNetwork(this.firestore);
    } catch (e) {
      console.warn('Failed to connect to Firebase');
    }

    this.connected = true;
  }

  async initializeStudyDb(studyId: string, config: object) {
    // Create or retrieve database for study
    this.studyCollection = collection(this.firestore, `${this.collectionPrefix}${studyId}`);

    const configDoc = doc(this.studyCollection, 'config');
    return await setDoc(configDoc, config);
  }

  async initializeParticipantSession(participantId: string, sequence: string[]) {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }

    // Check if the participant has already been initialized
    const participantDoc = doc(this.studyCollection, participantId);
    const participant = (await getDoc(participantDoc)).data() as ParticipantData | null;

    if (participant) {
      // Participant already initialized
      this.currentParticipantId = participantId;
      return participant;
    } else {
      // Initialize participant
      const participantData: ParticipantData = {
        participantId,
        sequence,
        answers: {},
      };
      await setDoc(participantDoc, participantData);

      // Set current participant id if updated
      await this.localForage.setItem('currentParticipantId', participantId);
      this.currentParticipantId = participantId;

      return participantData;
    }

  }

  async getParticipantSession() {
    if (!this._verifyStudyDatabase(this.studyCollection)) {
      throw new Error('Study database not initialized');
    }
    
    // Ensure we have currentParticipantId
    this.getCurrentParticipantId();

    // Get participant data
    let participant: ParticipantData | null = null;
    if (this.currentParticipantId !== null) {
      const participantDoc = doc(this.studyCollection, this.currentParticipantId);
      participant = (await getDoc(participantDoc)).data() as ParticipantData | null;
    }

    return participant;
  }

  async getCurrentParticipantId() {
    // Get currentParticipantId from localForage
    const currentParticipantId = await this.localForage.getItem('currentParticipantId');

    if (currentParticipantId) {
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

    // Check if we have provenance data
    let provenanceDoc: DocumentReference<DocumentData> | undefined = undefined;
    if (answer.provenanceGraph !== undefined) {
      // Make sure the participant has a provenance collection
      const provenanceCollection = collection(participantDoc, 'provenance');

      // Create a new provenance doc
      provenanceDoc = doc(provenanceCollection);
      await setDoc(provenanceDoc, answer.provenanceGraph);
    }

    const answerToSave: { answer: Record<string, Record<string, unknown>>, startTime: number, endTime: number } & Partial<{ provenanceGraph: string }> = {
      answer: answer.answer,
      startTime: answer.startTime,
      endTime: answer.endTime,
    };

    // If we don't have a provenance graph, remove it, else add the provenance doc reference
    if (provenanceDoc !== undefined) {
      answerToSave.provenanceGraph = provenanceDoc.id;
    }

    await setDoc(participantDoc, { answers: { [currentStep]: answerToSave } }, { merge: true });
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
      const provenanceCollection = await getDocs(collection(participant.ref, 'provenance'));

      participantDataItem.answers = Object.fromEntries(Object.entries(participantDataItem.answers).map(([key, value]) => {
        if (value === undefined) return [key, value];

        const provenanceGraphDoc = provenanceCollection.docs.find((doc) => doc.id === (value.provenanceGraph as unknown as string));
        const provenanceGraph = provenanceGraphDoc?.data() as TrrackedProvenance;
        return [key, { ...value, provenanceGraph }];
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
        const provenanceCollection = collection(participantDoc, 'provenance');
        const provenanceDocs = await getDocs(provenanceCollection);

        // Iterate over the participant answers and add the provenance graph
        Object.values(participant.answers).forEach((answer) => {
          if (answer === undefined) return;

          const provenanceGraph = provenanceDocs.docs.find((doc) => doc.id === (answer.provenanceGraph as unknown as string));
          answer.provenanceGraph = provenanceGraph?.data() as TrrackedProvenance;
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
    participantData.sequence.forEach((step) => {
      if (!participantData.answers[step]) {
        return false;
      }
    });

    return true;
  }

  private _verifyStudyDatabase(db: CollectionReference<DocumentData, DocumentData> | undefined): db is CollectionReference<DocumentData, DocumentData>  {
    return db !== undefined;
  }
}