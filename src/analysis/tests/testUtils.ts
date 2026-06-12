import type { StudyConfig } from '../../parser/types';

export function createMockStudyConfig(overrides: Partial<StudyConfig> = {}): StudyConfig {
  const baseConfig: StudyConfig = {
    $schema: '',
    studyMetadata: {
      title: '',
      version: '',
      authors: [],
      date: '',
      description: '',
      organizations: [],
    },
    uiConfig: {
      contactEmail: '',
      helpTextPath: '',
      logoPath: '',
      withProgressBar: false,
      autoDownloadStudy: false,
      withSidebar: false,
    },
    components: {},
    sequence: {
      order: 'fixed',
      components: [],
    },
  };

  return {
    ...baseConfig,
    ...overrides,
    studyMetadata: {
      ...baseConfig.studyMetadata,
      ...overrides.studyMetadata,
    },
    uiConfig: {
      ...baseConfig.uiConfig,
      ...overrides.uiConfig,
    },
    components: overrides.components ?? baseConfig.components,
    sequence: {
      ...baseConfig.sequence,
      ...overrides.sequence,
    },
  };
}
