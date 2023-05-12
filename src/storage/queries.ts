import {
  collection,
  collectionGroup,
  CollectionReference,
  DocumentData,
  DocumentReference,
  Firestore,
  getDocs,
  query,
  where,
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

export async function getAllParticipants(fs: Firestore, studyId: string) {
  console.group('Start');
  console.log({ studyId, STUDY_COLLECTION_ID });

  const trrackCollection = collectionGroup(fs, 'trrack');
  const filterByStudy = query(
    trrackCollection,
    where('__meta.studyId', '==', studyId)
  );

  const t = await getDocs(filterByStudy);

  console.log(t.docs);

  t.forEach((d) => {
    console.log(d.ref.parent.path);
    console.log(d.data());
  });

  console.groupEnd();
  return [];
}
