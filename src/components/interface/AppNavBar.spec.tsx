import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { AppNavBar } from './AppNavBar';

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => ({
    uiConfig: { instructionLocation: 'sidebar' },
    components: {
      c1: { instruction: 'Do task' },
    },
  }),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => 'c1',
}));

vi.mock('../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: (component: { instruction: string }) => ({
    ...component,
    instructionLocation: 'sidebar',
  }),
}));

vi.mock('../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: () => ({}),
}));

vi.mock('../ReactMarkdownWrapper', () => ({
  ReactMarkdownWrapper: ({ text }: { text: string }) => <div>{`md:${text}`}</div>,
}));

vi.mock('../response/ResponseBlock', () => ({
  ResponseBlock: () => <div>response-block</div>,
}));

describe('AppNavBar', () => {
  it('renders task instruction and sidebar response block', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <AppNavBar width={300} top={10} sidebarOpen />
      </MantineProvider>,
    );
    expect(html).toContain('Task:');
    expect(html).toContain('md:Do task');
    expect(html).toContain('response-block');
  });
});
