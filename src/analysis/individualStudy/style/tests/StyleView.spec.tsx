import { MantineProvider } from '@mantine/core';
import {
  fireEvent, render, waitFor,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StyleView } from '../StyleView';

const colorModeMocks = vi.hoisted(() => ({
  studyColorMode: 'light' as 'light' | 'dark' | null,
  updateStudyColorMode: vi.fn(),
}));

vi.mock('../../../../store/hooks/useStoredStudyColorMode', () => ({
  useStoredStudyColorMode: () => colorModeMocks,
}));

describe('StyleView', () => {
  beforeEach(() => {
    colorModeMocks.studyColorMode = 'light';
    colorModeMocks.updateStudyColorMode.mockReset();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('renders the planned style settings without a visible switch label', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <StyleView studyId="test-study" />
      </MantineProvider>,
    );

    expect(html).toContain('Default');
    expect(html).not.toContain('Light / dark mode');
  });

  test('saves dark mode when the default style switch is enabled', async () => {
    const { getByRole } = render(
      <MantineProvider>
        <StyleView studyId="test-study" />
      </MantineProvider>,
    );

    fireEvent.click(getByRole('switch'));

    await waitFor(() => {
      expect(colorModeMocks.updateStudyColorMode).toHaveBeenCalledWith('dark');
    });
  });
});
