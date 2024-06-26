import { AppShell } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import debounce from 'lodash.debounce';
import AppAside from './interface/AppAside';
import AppHeader from './interface/AppHeader';
import AppNavBar from './interface/AppNavBar';
import HelpModal from './interface/HelpModal';
import { AlertModal } from './interface/AlertModal';
import { EventType } from '../store/types';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { WindowEventsContext } from '../store/hooks/useWindowEvents';
import { useStoreSelector } from '../store/store';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { useStudyId } from '../routes/utils';

export function StepRenderer() {
  const windowEvents = useRef<EventType[]>([]);

  const studyConfig = useStudyConfig();
  const windowEventDebounceTime = studyConfig.uiConfig.windowEventDebounceTime ?? 100;

  const showStudyBrowser = useStoreSelector((state) => state.showStudyBrowser);

  // Attach event listeners
  useEffect(() => {
    // Focus
    const focusListener = debounce((e: FocusEvent) => {
      windowEvents.current.push([Date.now(), 'focus', e.target instanceof HTMLElement ? e.target.tagName : '']);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Inputs
    const inputListener = debounce((e: InputEvent) => {
      windowEvents.current.push([Date.now(), 'input', e.data ?? '']);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Keyboard
    const keypressListener = debounce((e: KeyboardEvent) => {
      windowEvents.current.push([Date.now(), 'keypress', e.key]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Mouse/Pointer/Touch
    const mouseDownListener = debounce((e: MouseEvent) => {
      windowEvents.current.push([Date.now(), 'mousedown', [e.clientX, e.clientY]]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    const mouseUpListener = debounce((e: MouseEvent) => {
      windowEvents.current.push([Date.now(), 'mouseup', [e.clientX, e.clientY]]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Window resizing
    const resizeListener = debounce(() => {
      windowEvents.current.push([Date.now(), 'resize', [window.innerWidth, window.innerHeight]]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Mouse movement
    const mouseMoveListener = debounce((e: MouseEvent) => {
      windowEvents.current.push([Date.now(), 'mousemove', [e.clientX, e.clientY]]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Scroll
    const scrollListener = debounce(() => {
      windowEvents.current.push([Date.now(), 'scroll', [window.scrollX, window.scrollY]]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Visibility change
    const visibilityListener = debounce(() => {
      windowEvents.current.push([Date.now(), 'visibility', document.visibilityState]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    window.addEventListener('focus', focusListener, true);
    window.addEventListener('input', inputListener as () => void);
    window.addEventListener('keypress', keypressListener);
    window.addEventListener('mousedown', mouseDownListener);
    window.addEventListener('mouseup', mouseUpListener);
    window.addEventListener('resize', resizeListener);
    window.addEventListener('mousemove', mouseMoveListener);
    window.addEventListener('scroll', scrollListener);
    document.addEventListener('visibilitychange', visibilityListener);

    return () => {
      window.removeEventListener('focus', focusListener, true);
      window.removeEventListener('input', inputListener as () => void);
      window.removeEventListener('keypress', keypressListener);
      window.addEventListener('mousedown', mouseDownListener);
      window.addEventListener('mouseup', mouseUpListener);
      window.removeEventListener('resize', resizeListener);
      window.removeEventListener('mousemove', mouseMoveListener);
      window.removeEventListener('scroll', scrollListener);
      document.removeEventListener('visibilitychange', visibilityListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sidebarWidth = studyConfig.uiConfig.sidebarWidth ?? 300;

  const { storageEngine } = useStorageEngine();
  const studyId = useStudyId();
  const [studyNavigatorEnabled, setStudyNavigatorEnabled] = useState(false);
  const [dataCollectionEnabled, setDataCollectionEnabled] = useState(false);
  useEffect(() => {
    const checkStudyNavigatorEnabled = async () => {
      if (storageEngine) {
        const modes = await storageEngine.getModes(studyId);
        setStudyNavigatorEnabled(modes.studyNavigatorEnabled);
        setDataCollectionEnabled(modes.dataCollectionEnabled);
      }
    };
    checkStudyNavigatorEnabled();
  }, [storageEngine, studyId]);

  const asideOpen = useMemo(() => studyNavigatorEnabled && showStudyBrowser, [studyNavigatorEnabled, showStudyBrowser]);

  return (
    <WindowEventsContext.Provider value={windowEvents}>
      <AppShell
        padding="md"
        header={{ height: 70 }}
        navbar={{ width: sidebarWidth, breakpoint: 'xs', collapsed: { desktop: !studyConfig.uiConfig.sidebar, mobile: !studyConfig.uiConfig.sidebar } }}
        aside={{ width: 360, breakpoint: 'xs', collapsed: { desktop: !asideOpen, mobile: !asideOpen } }}
      >
        <AppNavBar />
        <AppAside />
        <AppHeader studyNavigatorEnabled={studyNavigatorEnabled} dataCollectionEnabled={dataCollectionEnabled} />
        <HelpModal />
        <AlertModal />
        <AppShell.Main>
          <Outlet />
        </AppShell.Main>
      </AppShell>
    </WindowEventsContext.Provider>
  );
}
