import React, { createContext, useContext } from 'react';
import { EventType } from '../types';

// Create a context
export const WindowEventsContext = createContext<React.Ref<EventType[]>>(null);

export function useWindowEvents(): React.Ref<EventType[]> {
  const context = useContext(WindowEventsContext);
  if (!context) {
    throw new Error('useWindowEvents must be used within a WindowEventsProvider');
  }
  return context;
}
