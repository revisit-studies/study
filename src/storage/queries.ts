import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import {
  collection,
  Firestore,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { SESSIONS } from './constants';
import { loadProvenance } from './init';
import { FsSession } from './types';

/**

participants - details about participants e.g. demographics,etc
studies - details about studies, e.g. config
sessions - individual session with provenance, etc.

*/

export async function getAllSessions(fs: Firestore, studyId: string) {
  const sessionsRef = collection(fs, SESSIONS);
  const studySessions = query(sessionsRef, where('studyId', '==', studyId));

  const sessionDocs = (await getDocs(studySessions)).docs;

  const graphs: Array<{
    graph: ProvenanceGraph<any, any, any>;
    session: FsSession;
  }> = [];

  for (const sessionDoc of sessionDocs) {
    const g = await loadProvenance(fs, sessionDoc.id, false);
    graphs.push({
      graph: g,
      session: sessionDoc.data() as FsSession,
    });
  }

  return graphs;
}

export async function getAllSessionGraphs(fs: Firestore, studyId: string) {
  const graphs = await getAllSessions(fs, studyId);
  return graphs.map((g) => g.graph);
}
