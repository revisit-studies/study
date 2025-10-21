import { AppShell, Button, Flex } from '@mantine/core';
import { Outlet } from 'react-router';
import {
  useEffect, useMemo, useRef,
  useState,
} from 'react';
import debounce from 'lodash.debounce';
import { IconArrowLeft } from '@tabler/icons-react';
import { AppAside } from './interface/AppAside';
import { AppHeader } from './interface/AppHeader';
import { AppNavBar } from './interface/AppNavBar';
import { HelpModal } from './interface/HelpModal';
import { AlertModal } from './interface/AlertModal';
import { EventType } from '../store/types';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { WindowEventsContext } from '../store/hooks/useWindowEvents';
import { useStoreSelector, useStoreDispatch, useStoreActions } from '../store/store';
import { AnalysisFooter } from './interface/AnalysisFooter';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { studyComponentToIndividualComponent } from '../utils/handleComponentInheritance';
import { useCurrentComponent } from '../routes/utils';
import { ResolutionWarning } from './interface/ResolutionWarning';
import { useFetchStylesheet } from '../utils/fetchStylesheet';
import { ScreenRecordingContext, useScreenRecording } from '../store/hooks/useScreenRecording';
import { ScreenRecordingRejection } from './interface/ScreenRecordingRejection';

export function StepRenderer() {
  const windowEvents = useRef<EventType[]>([]);
  const dispatch = useStoreDispatch();
  const { toggleStudyBrowser } = useStoreActions();

  const isAnalysis = useIsAnalysis();
  const studyConfig = useStudyConfig();
  const currentComponent = useCurrentComponent();

  const componentConfig = useMemo(() => studyComponentToIndividualComponent(studyConfig.components[currentComponent] || {}, studyConfig), [currentComponent, studyConfig]);

  const windowEventDebounceTime = useMemo(() => componentConfig.windowEventDebounceTime ?? studyConfig.uiConfig.windowEventDebounceTime ?? 100, [componentConfig, studyConfig]);

  useFetchStylesheet(studyConfig?.uiConfig.stylesheetPath);

  const showStudyBrowser = useStoreSelector((state) => state.showStudyBrowser);
  const modes = useStoreSelector((state) => state.modes);

  const screenRecording = useScreenRecording();

  const { isRejected: isScreenRecordingUserRejected } = screenRecording;

  const analysisHasScreenRecording = useStoreSelector((state) => state.analysisHasScreenRecording);
  const analysisCanPlayScreenRecording = useStoreSelector((state) => state.analysisCanPlayScreenRecording);

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

  const { studyNavigatorEnabled, dataCollectionEnabled } = useMemo(() => modes, [modes]);

  // No default value for withSidebar since it's a required field in uiConfig
  const sidebarOpen = useMemo(() => (((analysisHasScreenRecording && analysisCanPlayScreenRecording) || currentComponent === 'end') ? false : (componentConfig.withSidebar ?? studyConfig.uiConfig.withSidebar)), [analysisHasScreenRecording, analysisCanPlayScreenRecording, currentComponent, componentConfig.withSidebar, studyConfig.uiConfig.withSidebar]);
  const sidebarWidth = useMemo(() => componentConfig?.sidebarWidth ?? studyConfig.uiConfig.sidebarWidth ?? 300, [componentConfig, studyConfig]);
  const showTitleBar = useMemo(() => componentConfig.showTitleBar ?? studyConfig.uiConfig.showTitleBar ?? true, [componentConfig, studyConfig]);

  const asideOpen = useMemo(() => studyNavigatorEnabled && showStudyBrowser, [studyNavigatorEnabled, showStudyBrowser]);

  const [hasAudio, setHasAudio] = useState<boolean>();

  return (
    <WindowEventsContext.Provider value={windowEvents}>
      <ScreenRecordingContext.Provider value={screenRecording}>
        <AppShell
          padding="md"
          header={{ height: showTitleBar ? 70 : 0 }}
          aside={{ width: 360, breakpoint: 'xs', collapsed: { desktop: !asideOpen, mobile: !asideOpen } }}
          footer={{ height: isAnalysis ? 125 + (hasAudio ? 55 : 0) : 0 }}
        >
          <AppAside />
          {showTitleBar && (
          <AppHeader studyNavigatorEnabled={studyNavigatorEnabled} dataCollectionEnabled={dataCollectionEnabled} />
          )}
          <ResolutionWarning />
          {isScreenRecordingUserRejected && <ScreenRecordingRejection />}
          <HelpModal />
          <AlertModal />
          <Flex direction="row" gap="xs">
            <AppNavBar width={sidebarWidth} top={showTitleBar ? 70 : 0} sidebarOpen={sidebarOpen} />
            {/* 10px is the gap between the sidebar and the main content */}
            <AppShell.Main className="main" style={{ display: 'flex', flexDirection: 'column' }} w={sidebarOpen ? `calc(100% - ${sidebarWidth}px - 10px)` : '100%'}>
              {!showTitleBar && !showStudyBrowser && studyNavigatorEnabled && (
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={14} />}
                onClick={() => dispatch(toggleStudyBrowser())}
                size="xs"
                style={{ position: 'fixed', top: '10px', right: '10px' }}
              >
                Study Browser
              </Button>
              )}
              <Outlet />
            </AppShell.Main>
          </Flex>
          {isAnalysis && (
          <AnalysisFooter setHasAudio={setHasAudio} />
          )}
        </AppShell>
      </ScreenRecordingContext.Provider>
    </WindowEventsContext.Provider>
  );
}
