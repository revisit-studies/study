import { MantineProvider } from '@mantine/core';
import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { HelpModal } from './HelpModal';

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  return {
    ...actual,
    Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

const state = {
  showHelpText: true,
  config: {
    uiConfig: { helpTextPath: 'help.md' },
    components: {
      c1: { helpTextPath: 'help.md' },
    },
  },
};

vi.mock('../../store/store', () => ({
  useStoreSelector: (selector: (s: typeof state) => unknown) => selector(state),
  useStoreDispatch: () => vi.fn(),
  useStoreActions: () => ({ toggleShowHelpText: () => ({ type: 'toggle' }) }),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => 'c1',
}));

vi.mock('../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: (component: { helpTextPath: string }) => component,
}));

vi.mock('../../utils/getStaticAsset', () => ({
  getStaticAssetByPath: vi.fn(async () => 'Help text'),
}));

vi.mock('../ReactMarkdownWrapper', () => ({
  ReactMarkdownWrapper: () => <div>markdown-help</div>,
}));

vi.mock('../../ResourceNotFound', () => ({
  ResourceNotFound: () => <div>resource-not-found</div>,
}));

describe('HelpModal', () => {
  it('renders help modal content area', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <HelpModal />
      </MantineProvider>,
    );
    expect(html).toContain('markdown-help');
  });
});
