import { AppShell } from '@mantine/core';
import { useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import {
  PID,
  SESSION_ID,
  STUDY_ID,
  setStudyIdentifiers,
  useAppDispatch,
  useAppSelector,
} from '../store';
import AppAside from './interface/AppAside';
import AppHeader from './interface/AppHeader';
import AppNavBar from './interface/AppNavBar';
import HelpModal from './interface/HelpModal';

export function Shell() {
  // get and set study identifiers from url
  useStudyIdentifiers();

  return (
    <AppShell
      navbarOffsetBreakpoint="sm"
      asideOffsetBreakpoint="sm"
      navbar={<AppNavBar />}
      aside={<AppAside />}
      header={<AppHeader />}
    >
      <HelpModal /> {/* <StudyController /> */}
      <Outlet />
    </AppShell>
  );
}

function useStudyIdentifiers() {
  const dispatch = useAppDispatch();
  const studyIdentifiers = useAppSelector((s) => s.study.studyIdentifiers);

  const [urlParams, setUrlParams] = useSearchParams();

  useEffect(() => {
    if (studyIdentifiers) return;

    const studyId = urlParams.get(STUDY_ID) || 'DEBUG';
    const pid = urlParams.get(PID) || 'DEBUG';
    const sessionId = urlParams.get(SESSION_ID) || crypto.randomUUID();

    setUrlParams(
      {
        ...urlParams,
        [STUDY_ID]: studyId,
        [PID]: pid,
        [SESSION_ID]: sessionId,
      },

      {
        replace: true,
      }
    );

    dispatch(
      setStudyIdentifiers({
        study_id: studyId,
        pid,
        session_id: sessionId,
      })
    );
  }, [urlParams]);
}
