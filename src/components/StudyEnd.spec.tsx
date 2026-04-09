import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { StudyEnd } from './StudyEnd';

const mockState = {
  modes: {
    dataCollectionEnabled: true,
  },
};

vi.mock('@mantine/core', () => ({
  Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
  Center: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Loader: () => <div>Loading</div>,
  Space: () => <div />,
  Text: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => ({
    studyMetadata: { title: 'Latency Study' },
    uiConfig: {
      studyEndMsg: 'Study complete',
      autoDownloadStudy: false,
    },
  }),
}));

vi.mock('./ReactMarkdownWrapper', () => ({
  ReactMarkdownWrapper: ({ text }: { text?: string }) => <div>{text}</div>,
}));

vi.mock('../utils/useDisableBrowserBack', () => ({
  useDisableBrowserBack: () => undefined,
}));

vi.mock('../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: undefined }),
}));

vi.mock('../routes/utils', () => ({
  useStudyId: () => 'test-study',
}));

vi.mock('../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('../store/store', () => ({
  useStoreDispatch: () => vi.fn(),
  useStoreSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
  useStoreActions: () => ({
    setParticipantCompleted: vi.fn((value: boolean) => ({
      type: 'setParticipantCompleted',
      payload: value,
    })),
    setIsSubmittingFinal: vi.fn((value: boolean) => ({
      type: 'setIsSubmittingFinal',
      payload: value,
    })),
  }),
}));

vi.mock('./downloader/DownloadTidy', () => ({
  download: vi.fn(),
}));

describe('StudyEnd', () => {
  beforeEach(() => {
    mockState.modes.dataCollectionEnabled = true;
  });

  test('renders the upload spinner while data collection is enabled', () => {
    const html = renderToStaticMarkup(<StudyEnd />);
    expect(html).toContain('Please wait while your answers are uploaded.');
    expect(html).toContain('Loading');
  });

  test('renders the study end message immediately when data collection is disabled', () => {
    mockState.modes.dataCollectionEnabled = false;

    const html = renderToStaticMarkup(<StudyEnd />);
    expect(html).toContain('Study complete');
  });
});
