import {
  createContext, ReactNode, useContext, useInsertionEffect, useLayoutEffect, useMemo, useState,
} from 'react';
import { MantineColorScheme, MantineProvider } from '@mantine/core';
import { useColorScheme, useLocalStorage } from '@mantine/hooks';

type AppThemeContextValue = {
  colorMode: 'light' | 'dark';
  toggleColorMode: () => void;
  setStudyColorMode: (colorMode: 'light' | 'dark' | undefined) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemColorMode = useColorScheme(undefined, { getInitialValueInEffect: false });
  const [userColorMode, setUserColorMode] = useLocalStorage<MantineColorScheme>({
    key: 'revisit-user-color-mode',
    defaultValue: 'auto',
    getInitialValueInEffect: false,
    serialize: (value) => value,
    deserialize: (value) => (value === 'light' || value === 'dark' ? value : 'auto'),
  });
  const [studyColorMode, setStudyColorMode] = useState<'light' | 'dark'>();
  const colorMode = userColorMode === 'auto' ? systemColorMode : userColorMode;
  const effectiveColorMode = studyColorMode ?? colorMode;
  useInsertionEffect(() => {
    // forceColorScheme bypasses Mantine's normal transition suppression.
    // Keep suppression until Mantine applies the requested root attribute and paints the theme.
    const style = document.createElement('style');
    style.textContent = '[class*="MRT_"], [class*="MRT_"] * { transition: none !important; }';
    document.head.appendChild(style);
    let frame: number | undefined;
    const root = document.documentElement;
    const restoreAfterThemeChange = (observer: MutationObserver) => {
      if (root.getAttribute('data-mantine-color-scheme') !== effectiveColorMode) return;
      observer.disconnect();
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => style.remove());
      });
    };
    const observer = new MutationObserver((_, currentObserver) => restoreAfterThemeChange(currentObserver));
    observer.observe(root, { attributes: true, attributeFilter: ['data-mantine-color-scheme'] });
    restoreAfterThemeChange(observer);
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      style.remove();
    };
  }, [effectiveColorMode]);
  const context = useMemo(() => ({
    colorMode,
    toggleColorMode: () => setUserColorMode(colorMode === 'dark' ? 'light' : 'dark'),
    setStudyColorMode,
  }), [colorMode, setUserColorMode]);

  return (
    <AppThemeContext.Provider value={context}>
      <MantineProvider forceColorScheme={effectiveColorMode}>
        {children}
      </MantineProvider>
    </AppThemeContext.Provider>
  );
}

export function useAppColorMode() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('AppThemeProvider is required');
  }
  return context;
}

export function useStudyColorMode(colorMode: 'light' | 'dark' = 'light') {
  const { setStudyColorMode } = useAppColorMode();
  useLayoutEffect(() => {
    setStudyColorMode(colorMode);
    return () => setStudyColorMode(undefined);
  }, [colorMode, setStudyColorMode]);
}
