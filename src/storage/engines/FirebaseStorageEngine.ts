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
  updateMetadata,
} from 'firebase/storage';
import {
  CollectionReference,
  DocumentData,
  Firestore,
  Timestamp,
  collection,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { ReCaptchaV3Provider, initializeAppCheck } from '@firebase/app-check';
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
} from './types';
import { EditedText, TaglessEditedText } from '../../analysis/individualStudy/thinkAloud/types';

export class FirebaseStorageEngine extends CloudStorageEngine {
  private RECAPTCHAV3TOKEN = import.meta.env.VITE_RECAPTCHAV3TOKEN;

  private firestore: Firestore;

  private studyCollection: CollectionReference<DocumentData, DocumentData>;

  private storage: FirebaseStorage;

  constructor(testing: boolean = false) {
    super('firebase', testing);

    const firebaseConfig = hjsonParse(import.meta.env.VITE_FIREBASE_CONFIG);
    const firebaseApp = initializeApp(firebaseConfig);
    this.firestore = initializeFirestore(firebaseApp, {});
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
        provider: new ReCaptchaV3Provider(this.RECAPTCHAV3TOKEN),
        isTokenAutoRefreshEnabled: false,
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

    const toUpload = withServerTimestamp ? { ...sequenceAssignment, timestamp: serverTimestamp() } : sequenceAssignment;
    await setDoc(participantSequenceAssignmentDoc, { ...toUpload, createdTime: serverTimestamp() });
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
    await updateDoc(participantSequenceAssignmentDoc, { completed: serverTimestamp() });
  }

  protected async _rejectParticipantRealtime(participantId: string) {
    await this.verifyStudyDatabase();
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const studyCollection = collection(
      this.firestore,
      `${this.collectionPrefix}${this.studyId}`,
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
    await updateDoc(participantSequenceAssignmentDoc, { rejected: true });
  }

  protected async _undoRejectParticipantRealtime(participantId: string) {
    await this.verifyStudyDatabase();
    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }
    if (!this.studyId) {
      throw new Error('Study ID is not set');
    }

    const studyCollection = collection(
      this.firestore,
      `${this.collectionPrefix}${this.studyId}`,
    );

    const sequenceAssignmentDoc = doc(studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );
    const participantSequenceAssignmentDoc = doc(
      sequenceAssignmentCollection,
      participantId,
    );
    await updateDoc(participantSequenceAssignmentDoc, { rejected: false });
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

    await updateDoc(participantSequenceAssignmentDoc, { claimed: true });
  }

  async initializeStudyDb(studyId: string) {
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
    } catch {
      console.warn('Failed to connect to Firebase.');
    }
  }

  async connect() {
    try {
      await enableNetwork(this.firestore);

      this.connected = true;
    } catch {
      console.warn('Failed to connect to Firebase');
    }
  }

  async getModes(studyId: string) {
    const revisitModesDoc = doc(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
      'modes',
    );
    const revisitModesData = await getDoc(revisitModesDoc);

    if (revisitModesData.exists()) {
      return revisitModesData.data() as Record<REVISIT_MODE, boolean>;
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

  async setMode(studyId: string, mode: REVISIT_MODE, value: boolean) {
    const revisitModesDoc = doc(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
      'modes',
    );

    return await setDoc(revisitModesDoc, { [mode]: value }, { merge: true });
  }

  protected async _setModesDocument(studyId: string, modesDocument: Record<string, unknown>): Promise<void> {
    const revisitModesDoc = doc(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
      'modes',
    );
    await setDoc(revisitModesDoc, modesDocument, { merge: true });
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

  protected async _copyRealtimeData(
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

  protected async _deleteRealtimeData(sourceCollectionName: string) {
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

  // Function to add collection name to metadata
  protected async _addDirectoryNameToSnapshots(directoryName: string) {
    try {
      const snapshotDoc = doc(this.firestore, `${this.collectionPrefix}${this.studyId}`, 'snapshots');
      await setDoc(
        snapshotDoc,
        { [directoryName]: { name: directoryName } } as SnapshotDocContent,
        { merge: true },
      );
    } catch (error) {
      console.error('Error adding collection to metadata:', error);
      throw error;
    }
  }

  protected async _removeDirectoryNameFromSnapshots(directoryName: string) {
    try {
      const snapshotDoc = doc(this.firestore, `${this.collectionPrefix}${this.studyId}`, 'snapshots');
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

  protected async _changeDirectoryNameInSnapshots(oldName: string, newName: string) {
    const snapshotDoc = doc(this.firestore, `${this.collectionPrefix}${this.studyId}`, 'snapshots');
    await setDoc(
      snapshotDoc,
      { [oldName]: { name: newName } },
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
