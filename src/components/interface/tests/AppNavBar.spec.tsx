import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AppNavBar } from '../AppNavBar';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockCurrentComponent = 'trial1';
let mockStudyConfig = {
  components: {} as Record<string, { response: unknown[]; instruction?: string; instructionLocation?: string }>,
  uiConfig: { instructionLocation: 'sidebar' as string },
};

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => mockStudyConfig,
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentComponent: () => mockCurrentComponent,
}));

vi.mock('../../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: () => null,
}));

vi.mock('../../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: (stepConfig: Record<string, unknown>, _config: Record<string, unknown>) => stepConfig,
}));

vi.mock('../../ReactMarkdownWrapper', () => ({
  ReactMarkdownWrapper: ({ text }: { text: string }) => (
    <span data-testid="markdown">{text}</span>
  ),
}));

vi.mock('../../response/ResponseBlock', () => ({
  ResponseBlock: () => <div data-testid="response-block" />,
}));

vi.mock('@mantine/core', () => ({
  Box: ({
    children, display, w, style,
  }: { children: ReactNode; display?: string; w?: number; style?: React.CSSProperties }) => (
    <div style={{ display, width: w, ...style }}>{children}</div>
  ),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AppNavBar', () => {
  beforeEach(() => {
    mockCurrentComponent = 'trial1';
    mockStudyConfig = {
      components: {},
      uiConfig: { instructionLocation: 'sidebar' },
    };
  });

  test('renders null when current component has no config', () => {
    mockStudyConfig = {
      components: {},
      uiConfig: { instructionLocation: 'sidebar' },
    };
    const html = renderToStaticMarkup(
      <AppNavBar width={300} top={60} bottom={0} sidebarOpen />,
    );
    expect(html).toBe('');
  });

  test('renders sidebar when currentConfig exists and sidebarOpen is true', () => {
    mockStudyConfig = {
      components: { trial1: { response: [], instruction: 'Do the task' } },
      uiConfig: { instructionLocation: 'sidebar' },
    };
    const html = renderToStaticMarkup(
      <AppNavBar width={300} top={60} bottom={0} sidebarOpen />,
    );
    expect(html).toContain('data-testid="response-block"');
  });

  test('shows instruction when instructionLocation is sidebar', () => {
    mockStudyConfig = {
      components: { trial1: { response: [], instruction: 'Complete the task' } },
      uiConfig: { instructionLocation: 'sidebar' },
    };
    const html = renderToStaticMarkup(
      <AppNavBar width={300} top={60} bottom={0} sidebarOpen />,
    );
    expect(html).toContain('Complete the task');
    expect(html).toContain('Task:');
  });

  test('hides instruction when instructionLocation is not sidebar', () => {
    mockStudyConfig = {
      components: { trial1: { response: [], instruction: 'Do the task', instructionLocation: 'aboveStimulus' } },
      uiConfig: { instructionLocation: 'aboveStimulus' },
    };
    const html = renderToStaticMarkup(
      <AppNavBar width={300} top={60} bottom={0} sidebarOpen />,
    );
    expect(html).not.toContain('Task:');
  });

  test('hides sidebar content when sidebarOpen is false', () => {
    mockStudyConfig = {
      components: { trial1: { response: [], instruction: 'Do the task' } },
      uiConfig: { instructionLocation: 'sidebar' },
    };
    const html = renderToStaticMarkup(
      <AppNavBar width={300} top={60} bottom={0} sidebarOpen={false} />,
    );
    expect(html).toContain('display:none');
  });

  test('constrains the sidebar between the fixed header and replay footer', () => {
    mockStudyConfig = {
      components: { trial1: { response: [], instruction: 'Do the task' } },
      uiConfig: { instructionLocation: 'sidebar' },
    };
    const html = renderToStaticMarkup(
      <AppNavBar width={300} top={70} bottom={125} sidebarOpen />,
    );

    expect(html).toContain('max-height:max(0px, calc(100dvh - 195px))');
    expect(html).toContain('overflow-y:auto');
    expect(html).toContain('position:sticky');
    expect(html).not.toContain('align-self:flex-start');
  });

  test('keeps participant sidebar and content under one page scrollbar', () => {
    mockStudyConfig = {
      components: { trial1: { response: [], instruction: 'Do the task' } },
      uiConfig: { instructionLocation: 'sidebar' },
    };
    const html = renderToStaticMarkup(
      <AppNavBar width={300} top={70} bottom={0} sidebarOpen />,
    );

    expect(html).toContain('position:relative');
    expect(html).not.toContain('overflow-y:auto');
    expect(html).not.toContain('max-height:');
  });
});
