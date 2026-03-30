import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { StudyEnd } from './StudyEnd';

vi.mock('@mantine/core', () => ({
  Center: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
  useStoreActions: () => ({
    setParticipantCompleted: vi.fn((value: boolean) => ({
      type: 'setParticipantCompleted',
      payload: value,
    })),
  }),
}));

vi.mock('./downloader/DownloadTidy', () => ({
  download: vi.fn(),
}));

describe('StudyEnd', () => {
  test('renders the study end message', () => {
    const html = renderToStaticMarkup(<StudyEnd />);
    expect(html).toContain('Study complete');
  });
});
