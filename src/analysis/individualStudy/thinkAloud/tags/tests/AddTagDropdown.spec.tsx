import { MantineProvider } from '@mantine/core';
import {
  cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterAll, afterEach, beforeAll, describe, expect, test, vi,
} from 'vitest';
import { AddTagDropdown } from '../AddTagDropdown';

beforeAll(() => {
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

describe('AddTagDropdown', () => {
  test('trims a valid tag name before creation and blocks blank names', async () => {
    const addTagCallback = vi.fn();
    render(<MantineProvider><AddTagDropdown addTagCallback={addTagCallback} currentNames={[]} /></MantineProvider>);

    const addButton = screen.getByRole('button', { name: 'Add Tag' }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('Enter tag name'), { target: { value: '  New Tag  ' } });
    expect(addButton.disabled).toBe(false);
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(addTagCallback).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Tag' }));
    });
  });

  test('blocks duplicate names case-insensitively within the supplied tag type', () => {
    const addTagCallback = vi.fn();
    render(<MantineProvider><AddTagDropdown addTagCallback={addTagCallback} currentNames={['Review']} /></MantineProvider>);

    fireEvent.change(screen.getByPlaceholderText('Enter tag name'), { target: { value: ' review ' } });

    expect(screen.getByText('Tag with this name already exists')).toBeDefined();
    const addButton = screen.getByRole('button', { name: 'Add Tag' }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
    fireEvent.click(addButton);
    expect(addTagCallback).not.toHaveBeenCalled();
  });

  test('preserves input and shows an inline error when persistence fails', async () => {
    const addTagCallback = vi.fn().mockRejectedValue(new Error('save failed'));
    render(<MantineProvider><AddTagDropdown addTagCallback={addTagCallback} currentNames={[]} /></MantineProvider>);

    const nameInput = screen.getByPlaceholderText('Enter tag name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'New Tag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Tag' }));

    expect(await screen.findByText('Unable to save tag. Try again.')).toBeDefined();
    expect(nameInput.value).toBe('New Tag');
  });
});
