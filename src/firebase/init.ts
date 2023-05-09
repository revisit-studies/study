// Import the functions you need from the SDKs you need
import { initializeAppCheck, ReCaptchaV3Provider } from '@firebase/app-check';
import { getAuth, signInAnonymously } from '@firebase/auth';
import { isStateNode, Nodes, ProvenanceNode } from '@trrack/core';
import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  DocumentData,
  DocumentReference,
  Firestore,
  getDoc,
  getDocs,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  runTransaction,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { createContext, useContext } from 'react';
import { Nullable } from '../parser/types';
import { StudyProvenance } from '../store';
import { getSessionRef } from './queries';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

export const TRRACK = 'trrack';

const fsConfig = {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
};

// Your web app's Firebase configuration
// This is safe to commit
const firebaseConfig = {
  apiKey: 'AIzaSyAm9QtUgx1lYPDeE0vKLN-lK17WfUGVkLo',
  authDomain: 'revisit-utah.firebaseapp.com',
  projectId: 'revisit-utah',
  storageBucket: 'revisit-utah.appspot.com',
  messagingSenderId: '811568460432',
  appId: '1:811568460432:web:995f6b4f1fc8042b5dde15',
};

/**
 * To develop locally:
 * First time you run the local server you will have a console log with App Check Debug Token
 * Copy this token and add it to app check settings in firebase. You can do it at the below link -
 * https://console.firebase.google.com/u/0/project/revisit-utah/appcheck/apps
 *
 * The App check token is mechanism we use to authenticate that our web-app is the one making requests. Requests from anywhere
 * else will result in authentication error. Debug token is required so that tokens don't need to be verified locally everytime.
 * For deployed version this should happen automatically. If you do not have access to firebase to add the token ---
 * contact Yiren, Kiran, Jack or Alex to get access
 */
export async function initFirebase(connect = true) {
  // Set debug token for recaptchav3
  if (!import.meta.env.PROD) {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  console.log('Hello');

  let pid = 'DEBUG'; // Default participant ID
  let connected = false; // default conn status
  let fStore: Nullable<Firestore> = null;

  // If asked to connect
  if (connect) {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);

    // perform an app check to get authorized token
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(
        '6LdjOd0lAAAAAASvFfDZFWgtbzFSS9Y3so8rHJth'
      ),
      isTokenAutoRefreshEnabled: true,
    });

    // create auth instance
    const auth = getAuth();

    // if current user not defined sign in
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    // get pid for anon logged in user
    pid = auth.currentUser?.uid || 'DEBUG';

    fStore = initializeFirestore(app, fsConfig);

    // create firestore instance with local persisted storage

    // if development update heartbeat check for debug
    if (!import.meta.env.PROD) {
      const connectBeat = doc(fStore, '__conn_check', 'heartbeat');

      setDoc(connectBeat, {
        [pid]: {
          'last-ping': new Date(),
        },
      });
    }

    // set connected to true if all went okay
    connected = true;
  }

  let studyId: Nullable<string> = null;
  let trrackRef: Nullable<DocumentReference<DocumentData>> = null;

  return {
    pid,
    setStudyId(_studyId: string) {
      studyId = _studyId;
      return this;
    },
    get isConnected() {
      return connected;
    },
    /**
     * Returns true if provenance was saved else false
     */
    async initialize(sessionId: string, trrack: StudyProvenance) {
      if (!this.isConnected || !studyId || !fStore) return null;

      const sessionsRef = getSessionRef(fStore, studyId, pid, sessionId);
      trrackRef = doc(sessionsRef, TRRACK);
      const trrackSnapshot = await getDoc(trrackRef);

      const save = async () => {
        if (fStore && trrackRef)
          await saveTrrackProvenance(
            fStore,
            trrackRef,
            JSON.parse(trrack.export())
          );
      };

      if (trrackSnapshot.exists()) {
        return save;
      } else {
        await save();
        return null;
      }
    },
    async loadProvenance(trrack: StudyProvenance, sessionId: string) {
      if (!this.isConnected || !studyId || !fStore) return false;
      console.log('Loading provenance');

      const sessionsRef = getSessionRef(fStore, studyId, pid, sessionId);
      trrackRef = doc(sessionsRef, TRRACK);
      const saved_graph = await retrieveTrrackProvenance(fStore, trrackRef);
      trrack.import(JSON.stringify(saved_graph));
    },
    async saveNewProvenanceNode(trrack: StudyProvenance) {
      if (!trrackRef || !fStore)
        throw new Error('cannot find reference to trrack in firebase');
      const batch = writeBatch(fStore);
      const current: ProvenanceNode<any, any, any> = JSON.parse(trrack.export())
        .nodes[trrack.current.id];
      const previousNodeId = isStateNode(current) ? current.parent : null;
      const previous: ProvenanceNode<any, any, any> = previousNodeId
        ? JSON.parse(trrack.export()).nodes[previousNodeId]
        : null;

      batch.set(trrackRef, { current: current.id }, { merge: true });
      const nodesRef = doc(trrackRef, 'nodes', current.id);

      const node = await getDoc(nodesRef);

      if (node.exists()) throw new Error('Node should not exist yet!');

      batch.set(nodesRef, current);

      if (previous) {
        const previousRef = doc(trrackRef, 'nodes', previous.id);

        const _p = await getDoc(previousRef);

        if (!_p.exists()) throw new Error('incorrect provenance history');

        batch.update(previousRef, 'children', [current.id]);
      }

      await batch.commit();
    },
  };
}

async function retrieveTrrackProvenance(
  fs: Firestore,
  ref: DocumentReference<DocumentData>
): Promise<ProvenanceGraph<any, any, any>> {
  return await runTransaction(fs, async (transaction) => {
    const doc = await transaction.get(ref);

    if (!doc.exists()) throw new Error('provenance instance does not exist.');

    const data: { current: string; root: string } = doc.data() as any;

    const q = query(collection(ref, 'nodes'));
    const qs = await getDocs(q);

    const nodes: Nodes<any, any, any> = {};

    qs.forEach((doc) => {
      const node = doc.data() as any;

      nodes[node.id] = node;
    });

    return {
      ...data,
      nodes,
    };
  });
}

function saveTrrackProvenance(
  fs: Firestore,
  ref: DocumentReference<DocumentData>,
  { nodes, current, root }: ProvenanceGraph<any, any, any>
) {
  const batch = writeBatch(fs);

  const nodesRef = collection(ref, 'nodes');

  Object.entries(nodes).forEach(([node_id, node]) => {
    batch.set(doc(nodesRef, node_id), node);
  });

  batch.set(ref, {
    current,
    root,
  });

  return batch.commit();
}

export type Firebase = Awaited<ReturnType<typeof initFirebase>>;

export const FirebaseContext = createContext<Firebase>(null!);

export function useFirebase() {
  return useContext(FirebaseContext);
}
