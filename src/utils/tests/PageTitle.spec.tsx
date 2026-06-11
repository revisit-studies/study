import { render, waitFor } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { PageTitle } from '../PageTitle';

vi.mock('react-router', () => ({
  useLocation: vi.fn(() => ({ pathname: '/', search: '', hash: '' })),
}));

describe('PageTitle', () => {
  test('sets document.title to the provided title', async () => {
    render(<PageTitle title="My Study" />);
    await waitFor(() => expect(document.title).toBe('My Study'));
  });

  test('renders null — produces no DOM element', () => {
    const { container } = render(<PageTitle title="Test" />);
    expect(container.firstChild).toBeNull();
  });

  test('updates document.title when the title prop changes', async () => {
    const { rerender } = render(<PageTitle title="First" />);
    await waitFor(() => expect(document.title).toBe('First'));
    rerender(<PageTitle title="Second" />);
    await waitFor(() => expect(document.title).toBe('Second'));
  });
});
