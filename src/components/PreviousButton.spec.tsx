import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ReactNode } from 'react';
import { PreviousButton } from './PreviousButton';

const mockGoToPreviousStep = vi.fn();
const mockDispatch = vi.fn();

vi.mock('@mantine/core', () => ({
  Button: ({
    children, disabled, onClick,
  }: { children: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
  ),
}));

vi.mock('../store/hooks/usePreviousStep', () => ({
  usePreviousStep: vi.fn(() => ({
    isPreviousDisabled: false,
    goToPreviousStep: mockGoToPreviousStep,
  })),
}));

vi.mock('../store/store', () => ({
  useStoreActions: vi.fn(() => ({
    setClickedPrevious: vi.fn(() => ({ type: 'setClickedPrevious' })),
  })),
  useStoreDispatch: vi.fn(() => mockDispatch),
}));

const { usePreviousStep } = await import('../store/hooks/usePreviousStep');

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('PreviousButton', () => {
  test('renders with the default label "Previous"', () => {
    const html = renderToStaticMarkup(<PreviousButton />);
    expect(html).toContain('Previous');
  });

  test('renders a custom label when provided', () => {
    const html = renderToStaticMarkup(<PreviousButton label="Back" />);
    expect(html).toContain('Back');
  });

  test('button is disabled when isPreviousDisabled is true', () => {
    vi.mocked(usePreviousStep).mockReturnValueOnce({
      isPreviousDisabled: true, goToPreviousStep: vi.fn(),
    });
    const html = renderToStaticMarkup(<PreviousButton />);
    expect(html).toContain('disabled');
  });

  test('button is not disabled when isPreviousDisabled is false', () => {
    const html = renderToStaticMarkup(<PreviousButton />);
    expect(html).not.toContain('disabled=""');
  });

  test('dispatches setClickedPrevious and calls goToPreviousStep on click', () => {
    const { unmount } = render(<PreviousButton />);
    fireEvent.click(screen.getByText('Previous'));
    expect(mockDispatch).toHaveBeenCalled();
    expect(mockGoToPreviousStep).toHaveBeenCalled();
    unmount();
  });
});
