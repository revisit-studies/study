// matchMedia must be stubbed before useDeviceRules.ts initialises its module-level snapshot.
// vi.hoisted runs before any imports, making the stub available during module evaluation.
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
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

describe('useDeviceRules – browser detection', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test('detects firefox browser via resize', () => {
    const { result } = renderHook(() => useDeviceRules());
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; rv:115.0) Gecko/20100101 Firefox/115.0',
    );
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(result.current.currentBrowser.name).toBe('firefox');
    expect(result.current.currentBrowser.version).toBe(115);
  });

  test('detects safari browser via resize', () => {
    const { result } = renderHook(() => useDeviceRules());
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/16.4 Safari/605.1.15',
    );
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(result.current.currentBrowser.name).toBe('safari');
    expect(result.current.currentBrowser.version).toBe(16);
  });

  test('detects edge browser via resize', () => {
    const { result } = renderHook(() => useDeviceRules());
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/114.0.0.0 Edg/114.0.1823.82',
    );
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(result.current.currentBrowser.name).toBe('edge');
    expect(result.current.currentBrowser.version).toBe(114);
  });

  test('detects chrome browser via resize', () => {
    const { result } = renderHook(() => useDeviceRules());
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36',
    );
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(result.current.currentBrowser.name).toBe('chrome');
    expect(result.current.currentBrowser.version).toBe(114);
  });

  test('blocks browser with matching name but version below minimum', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/50.0.2661.94 Safari/537.36',
    );
    const rules: StudyRules = {
      browsers: { allowed: [{ name: 'chrome', minVersion: 100 }] },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isBrowserAllowed).toBe(false);
  });

  test('allows browser with matching name and sufficient version', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36',
    );
    const rules: StudyRules = {
      browsers: { allowed: [{ name: 'chrome', minVersion: 100 }] },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isBrowserAllowed).toBe(true);
  });
});

describe('useDeviceRules – device detection', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test('detects mobile device via resize', () => {
    const { result } = renderHook(() => useDeviceRules());
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    );
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(result.current.currentDevice).toBe('mobile');
  });

  test('detects iPad tablet device via resize', () => {
    const { result } = renderHook(() => useDeviceRules());
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    );
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(result.current.currentDevice).toBe('tablet');
  });

  test('detects Android tablet (android without mobile) via resize', () => {
    const { result } = renderHook(() => useDeviceRules());
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 10; SM-T500) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36',
    );
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(result.current.currentDevice).toBe('tablet');
  });
});

describe('useDeviceRules – input detection', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    // Direct assignment works because vi.hoisted set matchMedia with writable: true
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  });

  test('detects mouse input when pointer:fine matches', () => {
    const { result } = renderHook(() => useDeviceRules());
    window.matchMedia = (query: string) => ({
      matches: query === '(pointer:fine)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(result.current.currentInputs).toContain('mouse');
  });

  test('allows input type when it is in the allowed list', () => {
    // Prime snapshot to have mouse input
    renderHook(() => useDeviceRules());
    window.matchMedia = (query: string) => ({
      matches: query === '(pointer:fine)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
    act(() => { window.dispatchEvent(new Event('resize')); });
    const rules: StudyRules = { inputs: { allowed: ['mouse'] } };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isInputAllowed).toBe(true);
  });
});

describe('useDeviceRules – display constraints', () => {
  test('disallows display when maxWidth is exceeded', () => {
    const rules: StudyRules = {
      display: {
        minWidth: 0, minHeight: 0, maxWidth: 1,
      },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isDisplayAllowed).toBe(false);
  });

  test('disallows display when maxHeight is exceeded', () => {
    const rules: StudyRules = {
      display: {
        minWidth: 0, minHeight: 0, maxHeight: 1,
      },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isDisplayAllowed).toBe(false);
  });

  test('disallows display when minHeight exceeds window height', () => {
    const rules: StudyRules = {
      display: { minWidth: 0, minHeight: 999999 },
    };
    const { result } = renderHook(() => useDeviceRules(rules));
    expect(result.current.isDisplayAllowed).toBe(false);
  });
});

describe('useDeviceRules – resize subscription', () => {
  test('updates display dimensions when window is resized', () => {
    const { result } = renderHook(() => useDeviceRules());

    Object.defineProperty(window, 'innerWidth', { value: 1111, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 2222, writable: true, configurable: true });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.currentDisplay.width).toBe(1111);
    expect(result.current.currentDisplay.height).toBe(2222);
  });

  test('does not re-notify listeners when dimensions are unchanged after resize', () => {
    const { result } = renderHook(() => useDeviceRules());
    const beforeWidth = result.current.currentDisplay.width;

    // Fire resize without changing dimensions
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.currentDisplay.width).toBe(beforeWidth);
  });
});
