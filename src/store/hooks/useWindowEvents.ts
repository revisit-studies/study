import React, { createContext, useContext } from 'react';
import { EventType } from '../types';

// Create a context
export type WindowEventsRef = React.RefObject<EventType[]> & { flushPending?: () => void };

export const WindowEventsContext = createContext<WindowEventsRef | null>(null);

export function useWindowEvents(): WindowEventsRef {
  const context = useContext(WindowEventsContext);
  if (!context) {
    throw new Error('useWindowEvents must be used within a WindowEventsProvider');
  }
  return context;
}
