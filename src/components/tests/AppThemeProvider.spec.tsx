import { StrictMode } from 'react';
import {
  act, cleanup, fireEvent, render,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AppThemeProvider, useAppColorMode, useStudyColorMode } from '../AppThemeProvider';

const preferenceKey = 'revisit-user-color-mode';
let systemDark = false;
const mediaListeners = new Set<(event: { matches: boolean }) => void>();

function setSystemDark(dark: boolean) {
  act(() => {
    systemDark = dark;
    mediaListeners.forEach((listener) => listener({ matches: dark }));
  });
}

function Study({ colorMode }: { colorMode?: 'light' | 'dark' }) {
  useStudyColorMode(colorMode);
  return <div>Study content</div>;
}

function Toggle() {
  const { colorMode, toggleColorMode } = useAppColorMode();
  return <button type="button" onClick={toggleColorMode}>{colorMode}</button>;
}

function expectTheme(mode: 'light' | 'dark') {
  expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe(mode);
}

beforeEach(() => {
  localStorage.clear();
  systemDark = false;
  mediaListeners.clear();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && systemDark,
    media: query,
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => mediaListeners.add(listener),
    removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => mediaListeners.delete(listener),
  })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AppThemeProvider', () => {
  describe('table transition suppression', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const suppressionStyles = () => [...document.head.querySelectorAll('style')]
      .filter((style) => style.textContent?.includes('[class*="MRT_"]'));

    function advanceFrame() {
      const callbacks = [...frames.values()];
      frames.clear();
      act(() => callbacks.forEach((callback) => callback(0)));
    }

    beforeEach(() => {
      frames.clear();
      nextFrame = 0;
      document.documentElement.removeAttribute('data-mantine-color-scheme');
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        nextFrame += 1;
        frames.set(nextFrame, callback);
        return nextFrame;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    });

    test('waits for the actual theme change before restoring transitions', async () => {
      const view = render(<AppThemeProvider><Toggle /></AppThemeProvider>);
      await act(async () => {});
      advanceFrame();
      advanceFrame();
      const root = document.documentElement;
      const setAttribute = root.setAttribute.bind(root);
      vi.spyOn(root, 'setAttribute').mockImplementation((name, value) => {
        if (name !== 'data-mantine-color-scheme') setAttribute(name, value);
      });

      fireEvent.click(view.getByRole('button', { name: 'light' }));
      advanceFrame();
      advanceFrame();
      expectTheme('light');
      expect(suppressionStyles()).toHaveLength(1);

      await act(async () => setAttribute('data-mantine-color-scheme', 'dark'));
      advanceFrame();
      expect(suppressionStyles()).toHaveLength(1);
      advanceFrame();
      expect(suppressionStyles()).toHaveLength(0);
    });

    test('restores transitions when the root already has the requested theme', async () => {
      document.documentElement.setAttribute('data-mantine-color-scheme', 'light');
      render(<StrictMode><AppThemeProvider><Toggle /></AppThemeProvider></StrictMode>);
      await act(async () => {});
      advanceFrame();
      expect(suppressionStyles()).toHaveLength(1);
      advanceFrame();
      expect(suppressionStyles()).toHaveLength(0);
    });

    test('cancels stale removal during rapid toggles and cleans up pending frames on unmount', async () => {
      const view = render(<AppThemeProvider><Toggle /></AppThemeProvider>);
      await act(async () => {});
      advanceFrame();
      fireEvent.click(view.getByRole('button', { name: 'light' }));
      await act(async () => {});
      advanceFrame();
      expect(suppressionStyles()).toHaveLength(1);
      fireEvent.click(view.getByRole('button', { name: 'dark' }));
      await act(async () => {});
      advanceFrame();
      expect(suppressionStyles()).toHaveLength(1);
      view.unmount();
      expect(frames.size).toBe(0);
      expect(suppressionStyles()).toHaveLength(0);
    });

    test('stops waiting for a theme change on unmount', async () => {
      const root = document.documentElement;
      const setAttribute = root.setAttribute.bind(root);
      vi.spyOn(root, 'setAttribute').mockImplementation((name, value) => {
        if (name !== 'data-mantine-color-scheme') setAttribute(name, value);
      });
      const view = render(<AppThemeProvider><Toggle /></AppThemeProvider>);
      view.unmount();
      await act(async () => setAttribute('data-mantine-color-scheme', 'light'));
      expect(frames.size).toBe(0);
      expect(suppressionStyles()).toHaveLength(0);
    });
  });

  test('follows system changes until the user chooses a mode, then preserves that choice on reload', () => {
    const view = render(<AppThemeProvider><Toggle /></AppThemeProvider>);
    expectTheme('light');
    setSystemDark(true);
    expectTheme('dark');
    fireEvent.click(view.getByRole('button', { name: 'dark' }));
    expectTheme('light');
    expect(localStorage.getItem(preferenceKey)).toBe('light');
    setSystemDark(false);
    setSystemDark(true);
    expectTheme('light');
    view.unmount();
    render(<AppThemeProvider><Toggle /></AppThemeProvider>);
    expectTheme('light');
  });

  test.each(['light', 'dark', undefined] as const)('uses the study mode %s without overwriting the personal preference', (colorMode) => {
    localStorage.setItem(preferenceKey, 'dark');
    const view = render(
      <StrictMode><AppThemeProvider><Study colorMode={colorMode} /></AppThemeProvider></StrictMode>,
    );
    expectTheme(colorMode ?? 'light');
    expect(localStorage.getItem(preferenceKey)).toBe('dark');
    view.rerender(<StrictMode><AppThemeProvider><Toggle /></AppThemeProvider></StrictMode>);
    expectTheme('dark');
  });

  test('keeps the resolved participant mode when the system preference changes', () => {
    render(<AppThemeProvider><Study colorMode="light" /></AppThemeProvider>);
    expectTheme('light');
    setSystemDark(true);
    expectTheme('light');
  });

  test('switches between resolved participant modes without changing the personal choice', () => {
    localStorage.setItem(preferenceKey, 'light');
    systemDark = true;
    const view = render(<AppThemeProvider><Study colorMode="dark" /></AppThemeProvider>);
    expectTheme('dark');
    view.rerender(<AppThemeProvider><Study colorMode="light" /></AppThemeProvider>);
    expectTheme('light');
    expect(localStorage.getItem(preferenceKey)).toBe('light');
  });

  test('cross-tab changes do not override a forced study or write the event back to storage', () => {
    const view = render(<AppThemeProvider><Study colorMode="dark" /></AppThemeProvider>);
    localStorage.setItem(preferenceKey, 'light');
    const setItem = vi.spyOn(localStorage, 'setItem');
    setItem.mockClear();
    act(() => {
      window.dispatchEvent(Object.assign(new Event('storage'), {
        key: preferenceKey, newValue: 'light', storageArea: localStorage,
      }));
    });
    expectTheme('dark');
    expect(setItem).not.toHaveBeenCalled();
    view.rerender(<AppThemeProvider><Toggle /></AppThemeProvider>);
    expectTheme('light');
  });

  test('ignores legacy study preferences and invalid personal values', () => {
    localStorage.setItem('mantine-color-scheme-value', 'dark');
    localStorage.setItem(preferenceKey, 'invalid');
    render(<AppThemeProvider><Toggle /></AppThemeProvider>);
    expectTheme('light');
    setSystemDark(true);
    expectTheme('dark');
  });
});
