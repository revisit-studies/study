import { createContext, useContext } from 'react';

export const StartupPreviewContext = createContext(false);

export function useIsStartupPreview() {
  return useContext(StartupPreviewContext);
}
