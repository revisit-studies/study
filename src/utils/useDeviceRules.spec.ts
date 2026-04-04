// matchMedia must be stubbed before useDeviceRules.ts initialises its module-level snapshot.
// vi.hoisted runs before any imports, making the stub available during module evaluation.
import { renderHook } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import type { StudyRules } from '../parser/types';
import { useDeviceRules } from './useDeviceRules';

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('useDeviceRules', () => {
  test('allows everything when no study rules are provided', () => {
    const { result } = renderHook(() => useDeviceRules());
    expect(result.current.isBrowserAllowed).toBe(true);
    expect(result.current.isDeviceAllowed).toBe(true);
    expect(result.current.isInputAllowed).toBe(true);
    expect(result.current.isDisplayAllowed).toBe(true);
  });

  test('allows everything when study rules have empty allowed lists', () => {
    const rules: StudyRules = {
      browsers: { allowed: [] },
      devices: { allowed: [] },
      inputs: { allowed: [] },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isBrowserAllowed).toBe(true);
    expect(result.current.isDeviceAllowed).toBe(true);
    expect(result.current.isInputAllowed).toBe(true);
  });

  test('disallows a browser not present in the allowed list', () => {
    const rules: StudyRules = {
      browsers: { allowed: [{ name: 'nonexistent-browser', minVersion: 1 }] },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isBrowserAllowed).toBe(false);
  });

  test('disallows a device type not present in the allowed list', () => {
    // jsdom reports desktop; tablet-only rule should block it
    const rules: StudyRules = {
      devices: { allowed: ['tablet'] },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isDeviceAllowed).toBe(false);
  });

  test('allows desktop when desktop is in the allowed list', () => {
    const rules: StudyRules = {
      devices: { allowed: ['desktop', 'tablet'] },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isDeviceAllowed).toBe(true);
  });

  test('disallows display when minWidth exceeds window width', () => {
    const rules: StudyRules = {
      display: { minWidth: 999999, minHeight: 0 },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isDisplayAllowed).toBe(false);
  });

  test('allows display when dimensions are within bounds', () => {
    const rules: StudyRules = {
      display: { minWidth: 1, minHeight: 1 },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isDisplayAllowed).toBe(true);
  });

  test('exposes current device info', () => {
    const { result } = renderHook(() => useDeviceRules());
    expect(result.current.currentDevice).toMatch(/^(desktop|tablet|mobile)$/);
    expect(result.current.currentBrowser).toHaveProperty('name');
    expect(result.current.currentBrowser).toHaveProperty('version');
    expect(result.current.currentDisplay).toHaveProperty('width');
    expect(result.current.currentDisplay).toHaveProperty('height');
  });
});
