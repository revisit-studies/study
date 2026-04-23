import React from 'react';
import { renderHook } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { WindowEventsContext, useWindowEvents } from '../useWindowEvents';
import type { EventType } from '../../types';

describe('useWindowEvents', () => {
  test('throws when used outside a WindowEventsContext provider', () => {
    // Suppress React's error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useWindowEvents())).toThrow(
      'useWindowEvents must be used within a WindowEventsProvider',
    );
    spy.mockRestore();
  });

  test('returns the ref value provided by the context', () => {
    const eventsRef: React.RefObject<EventType[]> = { current: [] };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(WindowEventsContext.Provider, { value: eventsRef }, children)
    );

    const { result } = renderHook(() => useWindowEvents(), { wrapper });
    expect(result.current).toBe(eventsRef);
  });
});
