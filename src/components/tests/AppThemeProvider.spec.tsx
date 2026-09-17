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
