import React, { createContext, useContext } from 'react';
import { EventType } from '../types';

// Create a context
export type WindowEventsRef = React.RefObject<EventType[]> & {
  flushPending?: () => void;
  checkpointPending?: Promise<boolean>;
  finalizeVisit?: (beforeComplete?: () => Promise<void>) => Promise<boolean>;
  visitFinalizing?: boolean;
  submissionPending?: boolean;
  submissionFinalizing?: boolean;
  submissionDeferredEvents?: EventType[];
};

export const WindowEventsContext = createContext<WindowEventsRef | null>(null);

export function useOptionalWindowEvents(): WindowEventsRef | null {
  return useContext(WindowEventsContext);
}

export function useWindowEvents(): WindowEventsRef {
  const context = useOptionalWindowEvents();
  if (!context) {
    throw new Error('useWindowEvents must be used within a WindowEventsProvider');
  }
  return context;
}
