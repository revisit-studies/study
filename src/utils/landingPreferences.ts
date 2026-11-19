import { useLocalStorage } from '@mantine/hooks';

/** Landing-page tabs that are hidden unless the viewer opts in from the settings menu. */
export const TUTORIALS_TAB_LABEL = 'Tutorials';
export const TESTS_TAB_LABEL = 'Tests';

export const SHOW_TUTORIALS_STORAGE_KEY = 'revisit-landing-show-tutorials';
export const SHOW_TESTS_STORAGE_KEY = 'revisit-landing-show-tests';

function useBooleanPreference(key: string) {
  // Mantine keeps every hook using the same key in sync, so the header toggle updates the landing page immediately.
  return useLocalStorage<boolean>({
    key,
    defaultValue: false,
    getInitialValueInEffect: false,
    serialize: (value) => String(value),
    deserialize: (value) => value === 'true',
  });
}

/** Viewer preferences for which optional landing-page tabs to show. Both default to off. */
export function useLandingPreferences() {
  const [showTutorials, setShowTutorials] = useBooleanPreference(SHOW_TUTORIALS_STORAGE_KEY);
  const [showTests, setShowTests] = useBooleanPreference(SHOW_TESTS_STORAGE_KEY);
  return {
    showTutorials, setShowTutorials, showTests, setShowTests,
  };
}

/** Whether a landing-page tab should be shown under the viewer's preferences. */
export function isTabVisible(label: string, { showTutorials, showTests }: { showTutorials: boolean; showTests: boolean }) {
  if (label === TUTORIALS_TAB_LABEL) return showTutorials;
  if (label === TESTS_TAB_LABEL) return showTests;
  return true;
}
