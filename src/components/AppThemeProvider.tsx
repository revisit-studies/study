import {
  createContext, ReactNode, useContext, useLayoutEffect, useMemo, useState,
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
