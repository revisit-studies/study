import { ReactNode } from 'react';
import {
  render, act, cleanup, screen,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { HelpModal } from './HelpModal';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockShowHelpText = true;
let mockConfig = {
  components: {} as Record<string, unknown>,
  uiConfig: { helpTextPath: undefined as string | undefined },
};
let mockGetStaticAssetByPath = vi.fn().mockResolvedValue(undefined);

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../store/store', () => ({
  useStoreSelector: (selector: (s: Record<string, unknown>) => unknown) => selector({
    showHelpText: mockShowHelpText,
    config: mockConfig,
  }),
  useStoreActions: () => ({ toggleShowHelpText: vi.fn() }),
  useStoreDispatch: () => vi.fn(),
}));

vi.mock('../../utils/getStaticAsset', () => ({
  getStaticAssetByPath: (...args: unknown[]) => mockGetStaticAssetByPath(...args),
}));

vi.mock('../../utils/Prefix', () => ({
  PREFIX: '/',
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => 'trial1',
}));

vi.mock('../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: () => ({ helpTextPath: undefined }),
}));

vi.mock('../ReactMarkdownWrapper', () => ({
  ReactMarkdownWrapper: ({ text }: { text: string }) => (
    <div data-testid="markdown">{text}</div>
  ),
}));

vi.mock('../../ResourceNotFound', () => ({
  ResourceNotFound: ({ path }: { path?: string }) => (
    <div data-testid="not-found">{path ?? 'not found'}</div>
  ),
}));

vi.mock('@mantine/core', () => ({
  Modal: ({ opened, children }: { opened: boolean; children: ReactNode }) => (
    opened ? <div role="dialog">{children}</div> : null
  ),
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('HelpModal', () => {
  beforeEach(() => {
    mockShowHelpText = true;
    mockConfig = {
      components: {},
      uiConfig: { helpTextPath: undefined },
    };
    mockGetStaticAssetByPath = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('renders nothing when showHelpText is false', async () => {
    mockShowHelpText = false;
    await act(async () => {
      render(<HelpModal />);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('shows ResourceNotFound when no helpTextPath configured', async () => {
    mockConfig = {
      components: {},
      uiConfig: { helpTextPath: undefined },
    };
    await act(async () => {
      render(<HelpModal />);
    });
    expect(screen.getByTestId('not-found')).toBeDefined();
  });

  test('shows markdown when asset is found', async () => {
    mockConfig = {
      components: {},
      uiConfig: { helpTextPath: 'help.md' },
    };
    mockGetStaticAssetByPath = vi.fn().mockResolvedValue('# Help Content');
    await act(async () => {
      render(<HelpModal />);
    });
    const markdown = screen.getByTestId('markdown');
    expect(markdown.textContent).toBe('# Help Content');
  });

  test('shows ResourceNotFound when asset fetch returns undefined', async () => {
    mockConfig = {
      components: {},
      uiConfig: { helpTextPath: 'missing.md' },
    };
    mockGetStaticAssetByPath = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      render(<HelpModal />);
    });
    expect(screen.getByTestId('not-found')).toBeDefined();
  });

  test('prefixes the help text path when fetching the asset', async () => {
    mockConfig = {
      components: {},
      uiConfig: { helpTextPath: 'help/guide.md' },
    };
    mockGetStaticAssetByPath = vi.fn().mockResolvedValue('content');
    await act(async () => {
      render(<HelpModal />);
    });
    expect(mockGetStaticAssetByPath).toHaveBeenCalledWith('/help/guide.md');
  });
});
