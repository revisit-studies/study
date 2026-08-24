import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AppNavBar } from '../AppNavBar';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockCurrentComponent = 'trial1';
let mockStudyConfig = {
  components: {} as Record<string, { response: unknown[]; instruction?: string; instructionLocation?: string; parameters?: Record<string, unknown> }>,
  uiConfig: { instructionLocation: 'sidebar' as string },
};
let mockStoredAnswer: { parameters?: Record<string, unknown> } | null = null;

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => mockStudyConfig,
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentComponent: () => mockCurrentComponent,
  useCurrentStep: () => 0,
}));

vi.mock('../../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: () => mockStoredAnswer,
}));

vi.mock('../../../store/store', () => ({
  useStoreSelector: (selector: (state: { answers: Record<string, unknown> }) => unknown) => selector({ answers: {} }),
  useFlatSequence: () => [],
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
  ResponseBlock: ({ config }: { config?: { parameters?: Record<string, unknown>; response?: Array<{ prompt?: string }> } }) => (
    <div data-testid="response-block">
      {config?.response?.[0]?.prompt?.replace('{{value}}', String(config.parameters?.value ?? ''))}
    </div>
  ),
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
    mockStoredAnswer = null;
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

  test('reserves room below the sidebar for the replay footer', () => {
    mockStudyConfig = {
      components: { trial1: { response: [], instruction: 'Do the task' } },
      uiConfig: { instructionLocation: 'sidebar' },
    };
    const html = renderToStaticMarkup(
      <AppNavBar width={300} top={70} bottom={125} sidebarOpen />,
    );

    expect(html).toContain('margin-bottom:125px');
    expect(html).toContain('position:relative');
    expect(html).not.toContain('overflow-y:auto');
    expect(html).not.toContain('max-height:');
  });

  test('uses the dynamic component\'s runtime parameters over the static config parameters when templating the instruction', () => {
    mockStudyConfig = {
      components: {
        trial1: {
          response: [],
          instruction: 'Value: {{value}}',
          parameters: { value: 'static' },
        },
      },
      uiConfig: { instructionLocation: 'sidebar' },
    };
    mockStoredAnswer = { parameters: { value: 'dynamic' } };

    const html = renderToStaticMarkup(
      <AppNavBar width={300} top={60} bottom={0} sidebarOpen />,
    );

    expect(html).toContain('Value: dynamic');
    expect(html).not.toContain('Value: static');
  });

  test('passes dynamic runtime parameters to sidebar responses', () => {
    mockStudyConfig = {
      components: {
        trial1: {
          response: [{ id: 'q1', type: 'shortText', prompt: 'Response: {{value}}' }],
          parameters: { value: 'static' },
        },
      },
      uiConfig: { instructionLocation: 'sidebar' },
    };
    mockStoredAnswer = { parameters: { value: 'dynamic' } };

    const html = renderToStaticMarkup(
      <AppNavBar width={300} top={60} bottom={0} sidebarOpen />,
    );

    expect(html).toContain('Response: dynamic');
    expect(html).not.toContain('Response: static');
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
    expect(html).toContain('margin-bottom:0');
    expect(html).not.toContain('overflow-y:auto');
    expect(html).not.toContain('max-height:');
  });
});
