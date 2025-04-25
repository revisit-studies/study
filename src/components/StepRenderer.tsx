import { AppShell } from '@mantine/core';
import { Outlet } from 'react-router';
import { useEffect, useMemo, useRef } from 'react';
import debounce from 'lodash.debounce';
import { AppAside } from './interface/AppAside';
import { AppHeader } from './interface/AppHeader';
import { AppNavBar } from './interface/AppNavBar';
import { HelpModal } from './interface/HelpModal';
import { AlertModal } from './interface/AlertModal';
import { EventType } from '../store/types';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { WindowEventsContext } from '../store/hooks/useWindowEvents';
import { useStoreSelector } from '../store/store';
import { AnalysisFooter } from './interface/AnalysisFooter';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { useCurrentComponent } from '../routes/utils';
import { studyComponentToIndividualComponent } from '../utils/handleComponentInheritance';

export function StepRenderer() {
  const windowEvents = useRef<EventType[]>([]);

  const studyConfig = useStudyConfig();
  const currentComponent = useCurrentComponent();
  const config = useStoreSelector((state) => state.config);
  const componentConfig = useMemo(() => studyComponentToIndividualComponent(config.components[currentComponent] || {}, config), [currentComponent, config]);

  const windowEventDebounceTime = studyConfig.uiConfig.windowEventDebounceTime ?? 100;

  const showStudyBrowser = useStoreSelector((state) => state.showStudyBrowser);
  const analysisHasAudio = useStoreSelector((state) => state.analysisHasAudio);
  const modes = useStoreSelector((state) => state.modes);

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
    const keydownListener = debounce((e: KeyboardEvent) => {
      windowEvents.current.push([Date.now(), 'keydown', e.key]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });
    const keyupListener = debounce((e: KeyboardEvent) => {
      windowEvents.current.push([Date.now(), 'keyup', e.key]);
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
    window.addEventListener('keydown', keydownListener);
    window.addEventListener('keyup', keyupListener);
    window.addEventListener('mousedown', mouseDownListener);
    window.addEventListener('mouseup', mouseUpListener);
    window.addEventListener('resize', resizeListener);
    window.addEventListener('mousemove', mouseMoveListener);
    window.addEventListener('scroll', scrollListener);
    document.addEventListener('visibilitychange', visibilityListener);

    return () => {
      window.removeEventListener('focus', focusListener, true);
      window.removeEventListener('input', inputListener as () => void);
      window.removeEventListener('keydown', keydownListener);
      window.removeEventListener('keyup', keyupListener);
      window.removeEventListener('mousedown', mouseDownListener);
      window.removeEventListener('mouseup', mouseUpListener);
      window.removeEventListener('resize', resizeListener);
      window.removeEventListener('mousemove', mouseMoveListener);
      window.removeEventListener('scroll', scrollListener);
      document.removeEventListener('visibilitychange', visibilityListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sidebarWidth = studyConfig.uiConfig.sidebarWidth ?? 300;

  const { studyNavigatorEnabled, dataCollectionEnabled } = useMemo(() => modes, [modes]);

  const asideOpen = useMemo(() => studyNavigatorEnabled && showStudyBrowser, [studyNavigatorEnabled, showStudyBrowser]);
  const sidebarOpen = componentConfig?.sidebar !== undefined ? componentConfig.sidebar : studyConfig.uiConfig.sidebar;

  const isAnalysis = useIsAnalysis();

  return (
    <WindowEventsContext.Provider value={windowEvents}>
      <AppShell
        padding="md"
        header={{ height: 70 }}
        navbar={{ width: (sidebarOpen ? sidebarWidth : 0), breakpoint: 'xs', collapsed: { desktop: !sidebarOpen, mobile: !sidebarOpen } }}
        aside={{ width: 360, breakpoint: 'xs', collapsed: { desktop: !asideOpen, mobile: !asideOpen } }}
        footer={{ height: (isAnalysis ? 75 : 0) + (analysisHasAudio ? 50 : 0) }}
      >
        <AppNavBar />
        <AppAside />
        <AppHeader studyNavigatorEnabled={studyNavigatorEnabled} dataCollectionEnabled={dataCollectionEnabled} />
        <HelpModal />
        <AlertModal />
        <AppShell.Main>
          <Outlet />
        </AppShell.Main>
        {isAnalysis && (
          <AnalysisFooter />
        )}
      </AppShell>
    </WindowEventsContext.Provider>
  );
}
