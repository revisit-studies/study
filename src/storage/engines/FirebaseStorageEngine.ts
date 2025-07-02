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
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { ReCaptchaV3Provider, initializeAppCheck } from '@firebase/app-check';
import { getAuth, signInAnonymously } from '@firebase/auth';
import {
  CloudStorageEngine,
  StoredUser,
  REVISIT_MODE,
  StorageObjectType,
  StorageObject,
  UserManagementData,
} from './types';

export class FirebaseStorageEngine extends CloudStorageEngine {
  private RECAPTCHAV3TOKEN = import.meta.env.VITE_RECAPTCHAV3TOKEN;

  private firestore: Firestore;

  private studyCollection: CollectionReference<DocumentData, DocumentData>;

  private storage: FirebaseStorage;

  constructor() {
    super('firebase');

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

  protected async _getFromStorage<T extends StorageObjectType>(
    prefix: string,
    type: T,
    studyId?: string,
  ) {
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

  protected async _cacheStorageObject<T extends StorageObjectType>(prefix: string, type: T) {
    const storageRef = ref(
      this.storage,
      `${this.collectionPrefix}${this.studyId}/${prefix}_${type}`,
    );
    await updateMetadata(storageRef, {
      cacheControl: 'public,max-age=31536000',
    });
  }

  protected async _pushToStorage<T extends StorageObjectType>(
    prefix: string,
    type: T,
    objectToUpload: StorageObject<T>,
  ) {
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

  protected async _verifyStudyDatabase() {
    // Throw an error if the db does not exist
    if (!this.studyCollection) {
      throw new Error('Study database not initialized');
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

  async _getCurrentConfigHash() {
    await this.verifyStudyDatabase();
    const configHashDoc = doc(
      this.studyCollection,
      'configHash',
    );
    const configHashDocData = await getDoc(configHashDoc);
    return configHashDocData.exists() ? configHashDocData.data().configHash : null;
  }

  async _setCurrentConfigHash(configHash: string) {
    await this.verifyStudyDatabase();
    const configHashDoc = doc(
      this.studyCollection,
      'configHash',
    );
    await setDoc(configHashDoc, { configHash });
  }

  async _getSequence() {
    await this.verifyStudyDatabase();

    if (!this.currentParticipantId) {
      throw new Error('Participant not initialized');
    }

    // Get the latin square
    const sequenceArray = await this.getSequenceArray();
    if (!sequenceArray) {
      throw new Error('Latin square not initialized');
    }

    if (this.studyId === undefined) {
      throw new Error('Study ID is not set');
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
      where('rejected', '==', true),
      where('claimed', '==', false),
    );
    const rejectedDocs = await getDocs(rejectedQuery);
    if (rejectedDocs.docs.length > 0) {
      const firstReject = rejectedDocs.docs[0];
      const firstRejectTime = firstReject.data().timestamp;
      if (modes.dataCollectionEnabled) {
        await setDoc(firstReject.ref, { claimed: true });
        await setDoc(participantSequenceAssignmentDoc, {
          participantId: this.currentParticipantId,
          timestamp: firstRejectTime, // Use the timestamp of the first reject
          rejected: false,
          claimed: false,
          completed: null,
          createdTime: serverTimestamp(),
        });
      }
    } else if (modes.dataCollectionEnabled) {
      await setDoc(participantSequenceAssignmentDoc, {
        participantId: this.currentParticipantId,
        timestamp: serverTimestamp(),
        rejected: false,
        claimed: false,
        completed: null,
        createdTime: serverTimestamp(),
      });
    }

    // Query all the intents to get a sequence and find our position in the queue
    const intentsQuery = query(
      sequenceAssignmentCollection,
      // where('rejected', '==', false),
      orderBy('timestamp', 'asc'),
    );
    const intentDocs = await getDocs(intentsQuery);
    const intents = intentDocs.docs.map((intent) => intent.data());

    // Get the current row
    const intentIndex = intents.filter((intent) => !intent.rejected).findIndex(
      (intent) => intent.participantId === this.currentParticipantId,
    ) % sequenceArray.length;
    const selectedIndex = intentIndex === -1
      ? Math.floor(Math.random() * sequenceArray.length - 1)
      : intentIndex;
    const currentRow = sequenceArray[selectedIndex];

    if (!currentRow) {
      throw new Error('Latin square is empty');
    }

    const creationSorted = intents.sort((a, b) => a.createdTime - b.createdTime);

    const creationIndex = creationSorted.findIndex((intent) => intent.participantId === this.currentParticipantId) + 1;

    return { currentRow, creationIndex };
  }

  async getAllParticipantIds() {
    await this.verifyStudyDatabase();

    const sequenceAssignmentDoc = doc(this.studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );
    const allAssignmentDocs = await getDocs(sequenceAssignmentCollection);

    return allAssignmentDocs.docs.map((d) => d.data().participantId);
  }

  async _getAudioUrl(
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

  async _setCompletedRealtime() {
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

  async _updateAdminUsersList(adminUsers: { adminUsersList: StoredUser[] }) {
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

  async _rejectParticipantRealtime(participantId: string) {
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

  async setMode(studyId: string, mode: REVISIT_MODE, value: boolean) {
    const revisitModesDoc = doc(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
      'metadata',
    );

    return await setDoc(revisitModesDoc, { [mode]: value }, { merge: true });
  }

  async getModes(studyId: string) {
    const revisitModesDoc = doc(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
      'metadata',
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

  async getParticipantsStatusCounts(studyId: string) {
    const studyCollection = collection(
      this.firestore,
      `${this.collectionPrefix}${studyId}`,
    );
    const sequenceAssignmentDoc = doc(studyCollection, 'sequenceAssignment');
    const sequenceAssignmentCollection = collection(
      sequenceAssignmentDoc,
      'sequenceAssignment',
    );
    const sequenceAssignmentsQuery = query(
      sequenceAssignmentCollection,
      orderBy('timestamp', 'asc'),
    );

    const sequenceAssignments = await getDocs(sequenceAssignmentsQuery);
    const sequenceAssignmentsData = sequenceAssignments.docs.map((d) => d.data());

    const completed = sequenceAssignmentsData.filter((assignment) => assignment.completed && !assignment.rejected).length;
    const rejected = sequenceAssignmentsData.filter((assignment) => assignment.rejected).length;
    const inProgress = sequenceAssignmentsData.length - completed - rejected;
    const minTime = sequenceAssignmentsData.length > 0 ? sequenceAssignmentsData[0].timestamp : null;
    const maxTime = sequenceAssignmentsData.length > 0 ? sequenceAssignmentsData.at(-1)!.timestamp : null;

    return {
      completed,
      rejected,
      inProgress,
      minTime,
      maxTime,
    };
  }

  async getSnapshots(studyId: string) {
    try {
      const metadataDoc = doc(this.firestore, `${this.collectionPrefix}${studyId}`, 'metadata', 'collections');
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
              transformedValue = value.name as string;
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

  // Function to add collection name to metadata
  async _addDirectoryNameToMetadata(directoryName: string) {
    try {
      const metadataDoc = doc(this.firestore, `${this.collectionPrefix}${this.studyId}`, 'metadata', 'collections');
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

  async _removeNameFromMetadata(directoryName: string) {
    try {
      const metadataDoc = doc(this.firestore, `${this.collectionPrefix}${this.studyId}`, 'metadata', 'collections');
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

  async _changeNameInMetadata(oldName: string, newName: string) {
    const metadataDoc = doc(this.firestore, `${this.collectionPrefix}${this.studyId}`, 'metadata', 'collections');
    await setDoc(
      metadataDoc,
      { [oldName]: { enabled: true, name: newName } },
      { merge: true },
    );
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

  async _copyRealtimeData(
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

  async _deleteRealtimeData(sourceCollectionName: string) {
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
}
