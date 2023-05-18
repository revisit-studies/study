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

async function restoreExistingSession(
  firestore: Firestore,
  sessionId: string,
  trrack: StudyProvenance
) {
  const graph = await loadProvenance(firestore, sessionId);

  trrack.import(JSON.stringify(graph));
}

async function createNewSession(
  firestore: Firestore,
  studyId: string,
  pid: string,
  sessionId: string,
  sessionExists: boolean,
  trrack: StudyProvenance
) {
  if (sessionExists) {
    await abandonSession(firestore, sessionId);
  }

  return await createSession(firestore, studyId, pid, trrack.root.id, trrack);
}

export async function initFirebase(
  connect: boolean
): Promise<ProvenanceStorage> {
  if (MODE === 'dev') {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  const { pid, firestore, connected } = await getFirestoreManager(connect);

  return {
    pid,
    connected,
    firestore,
    async initialize(
      studyId: string,
      sessionId: string,
      trrack: StudyProvenance
    ) {
      let session = await getSession(firestore, sessionId);

      const sessionExists = !!session && session.exists();

      if (!sessionExists) {
        await createNewSession(
          firestore,
          studyId,
          pid,
          sessionId,
          sessionExists,
          trrack
        );
        return null;
      }

      return {
        createNew: async () => {
          session = await createNewSession(
            firestore,
            studyId,
            pid,
            sessionId,
            sessionExists,
            trrack
          );
        },
        restoreSession: async () => {
          restoreExistingSession(firestore, sessionId, trrack);
        },
      };
    },
    saveNewProvenanceNode(trrack: StudyProvenance) {
      return saveProvenanceNode(firestore, trrack.root.id, trrack.current);
    },
    completeSession(sessionId: string) {
      return completeSession(firestore, sessionId);
    },
    abandonSession(sessionId: string) {
      return abandonSession(firestore, sessionId);
    },
  };
}

export const FirebaseContext = createContext<ProvenanceStorage>(null!);

export function useFirebase() {
  return useContext(FirebaseContext);
}

async function completeSession(store: Firestore, sessionId: string) {
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

async function abandonSession(store: Firestore, sessionId: string) {
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

    updateDoc(sessionRef, { status });
  }
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
  setDoc(sRef, sessh);

  // add node as collection
  const nodes = Object.values(trk.nodes);

  for (const node of nodes) {
    saveProvenanceNode(store, sessionId, node);
  }

  const session = await getDoc(sRef);

  return session;
}

export async function loadProvenance(
  store: Firestore,
  sessionId: string,
  restore = true
): Promise<ProvenanceGraph<any, any, any>> {
  const sessionRef = doc(store, SESSIONS, sessionId);
  const sessionDoc = await getDoc(sessionRef);

  if (!sessionDoc.exists()) throw new Error('session not found');

  const { current, root, status } = sessionDoc.data() as FsSession;

  const nodes: Nodes<any, any, any> = {};

  const nodesQuery = query(collection(sessionRef, NODES));
  const nodesList = await getDocs(nodesQuery);

  nodesList.forEach((nDoc) => {
    const node = nDoc.data() as ProvenanceNode<any, any, any>;

    nodes[node.id] = node;
  });

  if (restore) {
    status.history.push({
      status: 'restored',
      timestamp: serverTimestamp() as any,
    });

    updateDoc(sessionRef, {
      status,
    });
  }

  return { current, root, nodes };
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

  const graph = await loadProvenance(store, sessionId, false);
  console.log(graph);

  return addedNode;
}

async function getSession(store: Firestore, sessionId: string) {
  const sessionRef = doc(store, SESSIONS, sessionId);

  try {
    const session = await getDoc(sessionRef);
    return session;
  } catch (err) {
    return null;
  }
}
