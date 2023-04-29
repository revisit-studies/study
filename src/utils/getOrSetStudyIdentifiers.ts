import { PID, SESSION_ID } from '../store';
import { Nullable } from './nullable';

export type StudySessionInfo = {
  provenance: Nullable<string>;
  lastStepOrTrial: Nullable<string>;
};

/**
 * Check if url has study params, if not set them and return
 */
export function getOrSetStudyIdentifiers(studyId: string) {
  const searchParams = new URLSearchParams(window.location.search);

  const pid: Nullable<string> = searchParams.get(PID) || 'DEBUG';
  const sessionId: Nullable<string> = searchParams.get(SESSION_ID) || 'DEBUG';

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

  return {
    studyId,
    pId,
    sessionId,
    info,
    sync(opts: { provenance?: string; lastStepOrTrial?: string }) {
      const previous = getter()!;
      setter({
        ...previous,
        provenance: opts.provenance || previous.provenance,
        lastStepOrTrial: opts.lastStepOrTrial || previous.lastStepOrTrial,
      });
    },
  };
}
