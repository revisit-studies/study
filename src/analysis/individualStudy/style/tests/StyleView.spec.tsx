import { MantineProvider } from '@mantine/core';
import {
  cleanup, fireEvent, render, waitFor,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StyleView } from '../StyleView';
import { StudyStyle } from '../../../../storage/engines/types';

const colorModeMocks = vi.hoisted(() => ({
  studyColorMode: 'light' as 'light' | 'dark' | null,
  updateStudyColorMode: vi.fn(),
}));

const layoutMocks = vi.hoisted(() => ({
  studyStyle: 'default' as StudyStyle | null,
  updateStudyStyle: vi.fn(),
  isSaving: false,
  error: null as string | null,
}));

vi.mock('../../../../store/hooks/useStoredStudyStyle', () => ({
  useStoredStudyStyle: () => layoutMocks,
}));

vi.mock('../../../../store/hooks/useStoredStudyColorMode', () => ({
  useStoredStudyColorMode: () => colorModeMocks,
}));

describe('StyleView', () => {
  beforeEach(() => {
    colorModeMocks.studyColorMode = 'light';
    colorModeMocks.updateStudyColorMode.mockReset();
    layoutMocks.studyStyle = 'default';
    layoutMocks.updateStudyStyle.mockReset();
    layoutMocks.isSaving = false;
    layoutMocks.error = null;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    cleanup();
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

  test('saves dark mode independently of the selected style', async () => {
    layoutMocks.studyStyle = 'formLayout';
    const { getByRole } = render(
      <MantineProvider>
        <StyleView studyId="test-study" />
      </MantineProvider>,
    );

    fireEvent.click(getByRole('switch', { name: 'Dark mode' }));

    await waitFor(() => {
      expect(colorModeMocks.updateStudyColorMode).toHaveBeenCalledWith('dark');
    });
    expect(layoutMocks.updateStudyStyle).not.toHaveBeenCalled();
  });

  test('selects exactly one style and can return to Default without changing color mode', () => {
    const view = render(<MantineProvider><StyleView studyId="test-study" /></MantineProvider>);
    expect((view.getByRole('radio', { name: 'Default' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(view.getByRole('radio', { name: 'Form Layout' }));
    expect(layoutMocks.updateStudyStyle).toHaveBeenCalledWith('formLayout');
    layoutMocks.studyStyle = 'formLayout';
    view.rerender(<MantineProvider><StyleView studyId="test-study" /></MantineProvider>);
    expect((view.getByRole('radio', { name: 'Default' }) as HTMLInputElement).checked).toBe(false);
    expect((view.getByRole('radio', { name: 'Form Layout' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(view.getByRole('radio', { name: 'Default' }));
    expect(layoutMocks.updateStudyStyle).toHaveBeenLastCalledWith('default');
    expect(colorModeMocks.updateStudyColorMode).not.toHaveBeenCalled();
  });

  test('disables style selection during loading and saving and displays errors', () => {
    layoutMocks.studyStyle = null;
    const view = render(<MantineProvider><StyleView studyId="test-study" /></MantineProvider>);
    expect((view.getByRole('radio', { name: 'Form Layout' }) as HTMLInputElement).disabled).toBe(true);
    layoutMocks.studyStyle = 'formLayout';
    layoutMocks.isSaving = true;
    view.rerender(<MantineProvider><StyleView studyId="test-study" /></MantineProvider>);
    expect((view.getByRole('radio', { name: 'Form Layout' }) as HTMLInputElement).disabled).toBe(true);
    layoutMocks.isSaving = false;
    layoutMocks.error = 'Could not save study style. Please try again.';
    view.rerender(<MantineProvider><StyleView studyId="test-study" /></MantineProvider>);
    expect(view.getByRole('alert').textContent).toBe(layoutMocks.error);
  });

  test('placeholder styles cannot be selected', () => {
    const view = render(<MantineProvider><StyleView studyId="test-study" /></MantineProvider>);
    ['Style 3', 'Style 4'].forEach((name) => {
      const radio = view.getByRole('radio', { name }) as HTMLInputElement;
      expect(radio.disabled).toBe(true);
      fireEvent.click(radio);
    });
    expect(layoutMocks.updateStudyStyle).not.toHaveBeenCalled();
  });
});
