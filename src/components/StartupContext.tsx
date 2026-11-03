import {
  createContext, ReactNode, useContext, useLayoutEffect, useRef,
} from 'react';

const StartupInteractionContext = createContext(false);

const INPUT_EVENTS = [
  'keydown', 'keyup', 'keypress', 'pointerdown', 'pointermove', 'pointerup',
  'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'contextmenu',
  'touchstart', 'touchmove', 'touchend', 'wheel',
] as const;

export function StartupInteractionProvider({ value, children }: { value: boolean; children: ReactNode }) {
  const blocked = useRef(value);
  useLayoutEffect(() => {
    blocked.current = value;
  }, [value]);

  useLayoutEffect(() => {
    const blockInput = (event: Event) => {
      if (blocked.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    // Install before provisional stimuli mount, including their window-level shortcuts.
    INPUT_EVENTS.forEach((type) => window.addEventListener(type, blockInput, { capture: true, passive: false }));
    return () => INPUT_EVENTS.forEach((type) => window.removeEventListener(type, blockInput, true));
  }, []);

  return <StartupInteractionContext.Provider value={value}>{children}</StartupInteractionContext.Provider>;
}

export function useStartupInteractionBlocked() {
  return useContext(StartupInteractionContext);
}

const StudyStorageReadyContext = createContext(true);

export const StudyStorageReadyProvider = StudyStorageReadyContext.Provider;

export function useStudyStorageReady() {
  return useContext(StudyStorageReadyContext);
}
