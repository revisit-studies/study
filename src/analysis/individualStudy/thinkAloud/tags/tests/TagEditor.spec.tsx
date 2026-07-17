import { MantineProvider } from '@mantine/core';
import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterAll, afterEach, beforeAll, describe, expect, test, vi,
} from 'vitest';
import { TagEditor } from '../TagEditor';

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('TagEditor', () => {
  test('closes the creation popover only after persistence succeeds', async () => {
    let resolveSave: (() => void) | undefined;
    const createTagCallback = vi.fn(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));
    render(<MantineProvider><TagEditor createTagCallback={createTagCallback} tags={[]} /></MantineProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Create new tag' }));
    const nameInput = await screen.findByPlaceholderText('Enter tag name');
    fireEvent.change(nameInput, { target: { value: 'New Tag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Tag' }));

    expect(screen.getByPlaceholderText('Enter tag name')).toBeDefined();
    await act(async () => {
      resolveSave?.();
    });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Enter tag name')).toBeNull();
    });
  });

  test('keeps the creation popover open when persistence fails', async () => {
    const createTagCallback = vi.fn().mockRejectedValue(new Error('save failed'));
    render(<MantineProvider><TagEditor createTagCallback={createTagCallback} tags={[]} /></MantineProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Create new tag' }));
    fireEvent.change(await screen.findByPlaceholderText('Enter tag name'), { target: { value: 'New Tag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Tag' }));

    expect(await screen.findByText('Unable to save tag. Try again.')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter tag name')).toBeDefined();
  });
});
