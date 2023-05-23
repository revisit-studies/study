import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import { Nullable } from '../parser/types';
import { PID, SESSION_ID } from '../store';

export type StudySessionInfo = {
  provenance: Nullable<ProvenanceGraph<unknown, string, any>>;
  lastStepOrTrial: Nullable<string>;
};

export type SessionRecords = Record<string, StudySessionInfo>;
export type UserRecords = Record<string, SessionRecords>;
export type StudyRecords = Record<string, UserRecords>;

/**
 * Check if url has study params, if not set them and return
 */
export function getOrSetStudyIdentifiers(studyId: string) {
  const searchParams = new URLSearchParams(window.location.search);

  const pid = searchParams.get(PID) || 'DEBUG';
  const sessionId = searchParams.get(SESSION_ID) || 'DEBUG';

  const savedSession = localStorageSession(studyId, pid, sessionId);

  return {
    study_id: savedSession.studyId,
    pid: savedSession.pId,
    session_id: savedSession.sessionId,
    session: savedSession,
  };
}

function localStorageSession(studyId: string, pId: string, sessionId: string) {
  const session_key = `${studyId}_${pId}_${sessionId}`;
  const getter = () =>
    localStorage.getItem(session_key)
      ? (JSON.parse(localStorage.getItem(session_key)!) as StudySessionInfo)
      : null;
  const setter = (val: any) =>
    localStorage.setItem(
      session_key,
      typeof val === 'string' ? val : JSON.stringify(val)
    );

  const sessionString = getter();

  const info: StudySessionInfo = sessionString || {
    provenance: null,
    lastStepOrTrial: null,
  };

  if (!sessionString) setter(info);

  function sync(opts: {
    provenance?: ProvenanceGraph<any, any, any>;
    lastStepOrTrial?: string;
  }) {
    const previous = getter()!;
    setter({
      ...previous,
      provenance: opts.provenance || previous.provenance,
      lastStepOrTrial: opts.lastStepOrTrial || previous.lastStepOrTrial,
    });
  }

  return {
    studyId,
    pId,
    sessionId,
    info,
    sync,
  };
}
