import { AppShell } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import AppAside from './interface/AppAside';
import AppHeader from './interface/AppHeader';
import AppNavBar from './interface/AppNavBar';
import HelpModal from './interface/HelpModal';
import { AlertModal } from './interface/AlertModal';
import { createContext, useContext, useEffect, useRef } from 'react';
import debounce from 'lodash.debounce';
import { EventType } from '../store/types';

// Create a context
const WindowEventsContext = createContext<React.Ref<EventType[]>>(null);

export function useWindowEvents(): React.Ref<EventType[]> {
  const context = useContext(WindowEventsContext);
  if (!context) {
    throw new Error('useWindowEvents must be used within a WindowEventsProvider');
  }
  return context;
}

export function StepRenderer() {
  const windowEvents = useRef<EventType[]>([]);

  // Attach event listeners
  useEffect(() => {
    // Clipboard
    const copyListener = debounce((e: ClipboardEvent) => {
      windowEvents.current.push([Date.now(), 'copy', e.clipboardData?.getData('text') ?? '']);
    }, 100, {maxWait: 100});
  
    // Drag'n'drop
    const dragListener = debounce((e: DragEvent) => {
      windowEvents.current.push([Date.now(), 'drag', [e.clientX, e.clientY]]);
    }, 100, {maxWait: 100});
  
    // Wheel
    const wheelListener = debounce((e: WheelEvent) => {
      windowEvents.current.push([Date.now(), 'wheel', [e.deltaX, e.deltaY]]);
    }, 100, {maxWait: 100});
  
    // Focus
    const focusListener = debounce((e: FocusEvent) => {
      windowEvents.current.push([Date.now(), 'focus', e.target instanceof HTMLElement ? e.target.tagName : '']);
    }, 100, {maxWait: 100});
  
    // Inputs
    const inputListener = debounce((e: InputEvent) => {
      windowEvents.current.push([Date.now(), 'input', e.data ?? '']);
    }, 100, {maxWait: 100});
  
    // Keyboard
    const keypressListener = debounce((e: KeyboardEvent) => {
      windowEvents.current.push([Date.now(), 'keypress', e.key]);
    }, 100, {maxWait: 100});
  
    // Mouse/Pointer/Touch
    const clickListener = debounce((e: MouseEvent) => {
      windowEvents.current.push([Date.now(), 'click', [e.clientX, e.clientY]]);
    }, 100, {maxWait: 100});
  
    // Text selection
    const selectionListener = debounce(() => {
      const selection = window.getSelection()?.toString();
      windowEvents.current.push([Date.now(), 'selection', selection ?? '']);
    }, 100, {maxWait: 100});
  
    // Window resizing
    const resizeListener = debounce(() => {
      windowEvents.current.push([Date.now(), 'resize', [window.innerWidth, window.innerHeight]]);
    }, 100, {maxWait: 100});

    // Mouse movement
    const mouseMoveListener = debounce((e: MouseEvent) => {
      windowEvents.current.push([Date.now(), 'mousemove', [e.clientX, e.clientY]]);
    }, 100, {maxWait: 100});

    // Scroll
    const scrollListener = debounce(() => {
      windowEvents.current.push([Date.now(), 'scroll', [window.scrollX, window.scrollY]]);
    }, 100, {maxWait: 100});

    // Visibility change
    const visibilityListener = debounce(() => {
      windowEvents.current.push([Date.now(), 'visibility', document.visibilityState]);
    }, 100, {maxWait: 100});
  
    window.addEventListener('copy', copyListener);
    window.addEventListener('drag', dragListener);
    window.addEventListener('wheel', wheelListener);
    window.addEventListener('focus', focusListener, true);
    window.addEventListener('input', inputListener as () => void);
    window.addEventListener('keypress', keypressListener);
    window.addEventListener('click', clickListener);
    document.addEventListener('selectionchange', selectionListener);
    window.addEventListener('resize', resizeListener);
    window.addEventListener('mousemove', mouseMoveListener);
    window.addEventListener('scroll', scrollListener);
    document.addEventListener('visibilitychange', visibilityListener);
  
    return () => {
      window.removeEventListener('copy', copyListener);
      window.removeEventListener('drag', dragListener);
      window.removeEventListener('wheel', wheelListener);
      window.removeEventListener('focus', focusListener, true);
      window.removeEventListener('input', inputListener as () => void);
      window.removeEventListener('keypress', keypressListener);
      window.removeEventListener('click', clickListener);
      document.removeEventListener('selectionchange', selectionListener);
      window.removeEventListener('resize', resizeListener);
      window.removeEventListener('mousemove', mouseMoveListener);
      window.removeEventListener('scroll', scrollListener);
      document.removeEventListener('visibilitychange', visibilityListener);
    };
  }, []);

  return (
    <WindowEventsContext.Provider value={windowEvents}>
      <AppShell
        navbar={<AppNavBar />}
        aside={<AppAside />}
        header={<AppHeader />}
      >
        <HelpModal />
        <AlertModal />
        <Outlet />
      </AppShell>
    </WindowEventsContext.Provider>
  );
}
