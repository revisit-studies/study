// Import the functions you need from the SDKs you need
import { Nodes, ProvenanceNode } from '@trrack/core';
import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { createContext, useContext } from 'react';
import { StudyProvenance } from '../store';
import { MODE, NODES, SESSIONS } from './constants';
import { getFirestoreManager } from './firebase';
import { FsSession, ProvenanceStorage } from './types';

/**
 * added here as substitute to firestore method serverTimestamp
 */
function serverTimestamp() {
  return new Date();
}

export async function init(_connect = true): Promise<ProvenanceStorage> {
  if (MODE === 'dev') {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  const { pid, store } = await getFirestoreManager();

  async function completeSession(sessionId: string) {
    const sessionRef = doc(store, SESSIONS, sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const { status } = sessionDoc.data() as FsSession;

      if (status.endStatus) return;
      const sts = {
        status: 'completed',
        timestamp: serverTimestamp(),
      };
      status.history.push(sts as any);
      status.endStatus = sts as any;

      await updateDoc(sessionRef, { status });
    }
  }
  async function abandonSession(sessionId: string) {
    const sessionRef = doc(store, SESSIONS, sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const { status } = sessionDoc.data() as FsSession;

      if (status.endStatus) return;

      const sts = {
        status: 'abandoned',
        timestamp: serverTimestamp(),
      };
      status.history.push(sts as any);
      status.endStatus = sts as any;

      await updateDoc(sessionRef, { status });
    }
  }

  return {
    pid,
    async initialize(
      studyId: string,
      sessionId: string,
      trrack: StudyProvenance
    ) {
      let session = await getSession(store, sessionId);

      const sessionExists = session.exists();

      async function createNew() {
        if (sessionExists) {
          await abandonSession(sessionId);
        }

        session = await createSession(
          store,
          studyId,
          pid,
          trrack.root.id,
          trrack
        );
      }

      async function restoreSession() {
        const graph = await loadProvenance(store, sessionId);
        trrack.import(JSON.stringify(graph));
      }

      if (!sessionExists) {
        await createNew();
        return null;
      }

      return {
        createNew,
        restoreSession,
      };
    },
    saveNewProvenanceNode(trrack: StudyProvenance) {
      return saveProvenanceNode(store, trrack.root.id, trrack.current);
    },
    completeSession,
    abandonSession,
  };
}

export const FirebaseContext = createContext<ProvenanceStorage>(null!);

export function useFirebase() {
  return useContext(FirebaseContext);
}

async function createSession(
  store: Firestore,
  studyId: string,
  pid: string,
  sessionId: string,
  trrack: StudyProvenance
) {
  const trk: ProvenanceGraph<any, any, any> = JSON.parse(trrack.export());

  const sRef = doc(store, SESSIONS, sessionId);

  const sessh: FsSession = {
    studyId,
    pid,
    lastUpdatedAt: serverTimestamp() as any,
    lastSavedNode: trk.root,
    current: trk.current,
    root: trk.root,
    status: {
      history: [
        {
          status: 'started',
          timestamp: serverTimestamp() as any,
        },
      ],
      endStatus: null,
    },
  };

  // create document
  await setDoc(sRef, sessh);

  // add node as collection
  const nodes = Object.values(trk.nodes);

  for (const node of nodes) {
    await saveProvenanceNode(store, sessionId, node);
  }

  const session = await getDoc(sRef);

  return session;
}

export async function loadProvenance(
  store: Firestore,
  sessionId: string
): Promise<ProvenanceGraph<any, any, any>> {
  return await runTransaction(store, async (trx) => {
    const sessionRef = doc(store, SESSIONS, sessionId);
    const sessionDoc = await trx.get(sessionRef);

    if (!sessionDoc.exists()) throw new Error('session not found');

    const { current, root, status } = sessionDoc.data() as FsSession;

    const nodes: Nodes<any, any, any> = {};

    const nodesQuery = query(collection(sessionRef, NODES));
    const nodesList = await getDocs(nodesQuery);

    nodesList.forEach((nDoc) => {
      const node = nDoc.data() as ProvenanceNode<any, any, any>;

      nodes[node.id] = node;
    });

    status.history.push({
      status: 'restored',
      timestamp: serverTimestamp() as any,
    });

    trx.update(sessionRef, {
      status,
    });

    return { current, root, nodes };
  });
}

async function saveProvenanceNode(
  store: Firestore,
  sessionId: string,
  _node: ProvenanceNode<any, any, any>
) {
  const node: ProvenanceNode<any, any, any> = JSON.parse(JSON.stringify(_node));
  const batch = writeBatch(store);

  const sessionRef = doc(store, SESSIONS, sessionId);
  const nodes = collection(sessionRef, NODES);

  await batch
    .set(doc(nodes, node.id), node)
    .update(sessionRef, {
      lastUpdatedAt: serverTimestamp(),
      current: node.id,
    })
    .commit();

  const addedNode = await getDoc(doc(nodes, node.id));

  return addedNode;
}

async function getSession(store: Firestore, sessionId: string) {
  const sessionRef = doc(store, SESSIONS, sessionId);

  const session = await getDoc(sessionRef);

  return session;
}

// export async function initFirebase(_connect = true) {
//   return {
//     pid,
//     setStudyId(_studyId: string) {
//       studyId = _studyId;
//       return this;
//     },
//     get isConnected() {
//       return connected;
//     },
//     /**
//      * Returns true if provenance was saved else false
//      */
//     async initialize(sessionId: string, trrack: StudyProvenance) {
//       if (!this.isConnected || !studyId || !fStore) return null;

//       const sessionsRef = getSessionRef(fStore, studyId, pid, sessionId);
//       trrackRef = doc(sessionsRef, TRRACK);
//       const trrackSnapshot = await getDoc(trrackRef);

//       const save = async () => {
//         if (fStore && trrackRef)
//           await saveTrrackProvenance(
//             fStore,
//             trrackRef,
//             JSON.parse(trrack.export())
//           );
//       };

//       if (trrackSnapshot.exists()) {
//         return save;
//       } else {
//         await save();
//         return null;
//       }
//     },
//     async loadProvenance(trrack: StudyProvenance, sessionId: string) {
//       if (!this.isConnected || !studyId || !fStore) return false;
//       console.log('Loading provenance');

//       const sessionsRef = getSessionRef(fStore, studyId, pid, sessionId);
//       trrackRef = doc(sessionsRef, TRRACK);
//       const saved_graph = await retrieveTrrackProvenance(fStore, trrackRef);

//       const container = new (function Test() {} as any)();
//       (window as any).container = container;
//       container.sg = saved_graph;
//       container.ss = JSON.stringify(saved_graph);
//       container.ssc = lz.compressToBase64(container.ss);

//       trrack.import(JSON.stringify(saved_graph));
//     },
//     async saveNewProvenanceNode(trrack: StudyProvenance) {
//       if (!trrackRef || !fStore)
//         throw new Error('cannot find reference to trrack in firebase');
//       const batch = writeBatch(fStore);
//       const current: ProvenanceNode<any, any, any> = JSON.parse(trrack.export())
//         .nodes[trrack.current.id];
//       const previousNodeId = isStateNode(current) ? current.parent : null;
//       const previous: ProvenanceNode<any, any, any> = previousNodeId
//         ? JSON.parse(trrack.export()).nodes[previousNodeId]
//         : null;

//       batch.set(trrackRef, { current: current.id }, { merge: true });
//       const nodesRef = doc(trrackRef, 'nodes', current.id);

//       const node = await getDoc(nodesRef);

//       if (node.exists()) throw new Error('Node should not exist yet!');

//       batch.set(nodesRef, current);

//       if (previous) {
//         const previousRef = doc(trrackRef, 'nodes', previous.id);

//         const _p = await getDoc(previousRef);

//         if (!_p.exists()) throw new Error('incorrect provenance history');

//         batch.update(previousRef, 'children', [current.id]);
//       }

//       await batch.commit();
//     },
//   };
// }

// async function retrieveTrrackProvenance(
//   fs: Firestore,
//   ref: DocumentReference<DocumentData>
// ): Promise<ProvenanceGraph<any, any, any>> {
//   return await runTransaction(fs, async (transaction) => {
//     const doc = await transaction.get(ref);

//     if (!doc.exists()) throw new Error('provenance instance does not exist.');

//     const data: { current: string; root: string } = doc.data() as any;

//     const q = query(collection(ref, 'nodes'));
//     const qs = await getDocs(q);

//     const nodes: Nodes<any, any, any> = {};

//     qs.forEach((doc) => {
//       const node = doc.data() as any;

//       nodes[node.id] = node;
//     });

//     return {
//       ...data,
//       nodes,
//     };
//   });
// }

// function saveTrrackProvenance(
//   fs: Firestore,
//   ref: DocumentReference<DocumentData>,
//   { nodes, current, root }: ProvenanceGraph<any, any, any>
// ) {
//   const batch = writeBatch(fs);

//   const nodesRef = collection(ref, 'nodes');

//   Object.entries(nodes).forEach(([node_id, node]) => {
//     batch.set(doc(nodesRef, node_id), node);
//   });

//   batch.set(ref, {
//     current,
//     root,
//   });

//   return batch.commit();
// }
