import {
  collection,
  CollectionReference,
  doc,
  DocumentData,
  DocumentReference,
  Firestore,
  getDoc,
  setDoc,
} from 'firebase/firestore';

export const STUDY_COLLECTION_ID = import.meta.env.PROD ? 'deployed' : 'debug';

export type FirebaseCollection = CollectionReference<DocumentData>;
export type FirebaseDoc = DocumentReference<DocumentData>;

export function getStudyCollectionRef(fs: Firestore) {
  return collection(fs, STUDY_COLLECTION_ID);
}

/**

<> - collections
rest - docs

/<mode>/studies/<study-id>/participants/<pid>/sessions/<sid>/


*/

export function getSessionRef(
  fs: Firestore,
  studyId: string,
  pid: string,
  sessionId: string
) {
  return collection(
    fs,
    `${STUDY_COLLECTION_ID}/studies/${studyId}/participants/${pid}/sessions/${sessionId}`
  );
}

const saveToFB = async (fb: any, path: string, data: any, errMsg: string) => {
  try {
    const docRef = setDoc(doc(fb, path), data, { merge: true });
    return docRef;
  } catch (e) {
    console.error(errMsg, e);
  }
};

export const addExpToUser = async (
  fb: any,
  studyID: string,
  pid: string,
  signature: string
) => {
  const data = {
    [studyID]: {
      studyID: studyID,
      signature: signature,
      timeStamp: Date.now(),
    },
  };
  const path = `users/${pid}`;

  saveToFB(fb, path, data, 'Firebase error adding experiment to user: ');
};

export const saveTrialToFB = async (
  fb: any,
  pid: string,
  studyID: string,
  trialID: string,
  currentStep: string,
  answer: string | object,
  type: 'trials' | 'practice'
) => {
  const path = `${studyID}/${pid}`;
  const data = {
    [trialID]: {
      trialID: trialID,
      timeStamp: Date.now(),
      answer: answer,
      type: type,
      step: currentStep,
      expID: studyID,
    },
  };
  return saveToFB(fb, path, data, 'Firebase error adding trial: ');
};

export const saveSurveyToFB = async (
  fb: any,
  pid: string,
  studyID: string,
  survey: Record<string, string | number>
) => {
  const path = `${studyID}-survey/${pid}`;
  saveToFB(fb, path, survey, 'Firebase error adding survey: ');
};

const getData = async (fb: any, path: string, errMsg: string) => {
  try {
    const docRef = doc(fb, path);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (e) {
    console.error(errMsg, e);
  }
};

export const getUser = async (fb: any, pid: string) => {
  const path = `users/${pid}`;
  return await getData(fb, path, 'error reading user data: ');
};

export const getTrial = async (fb: any, studyID: string, pid: string) => {
  const path = `${studyID}/${pid}`;
  return await getData(fb, path, 'error reading trial data: ');
};

export const getSurvey = async (fb: any, studyID: string, pid: string) => {
  const path = `${studyID}-survey/${pid}`;
  return await getData(fb, path, 'error reading survey data: ');
};
