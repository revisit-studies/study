import { MantineProvider } from '@mantine/core';
import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterAll, afterEach, beforeAll, describe, expect, test, vi,
} from 'vitest';
import { Tag } from '../../types';
import { EditTagPopover } from '../EditTagPopover';

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

const tag: Tag = { id: 'tag-1', name: 'Original Tag', color: '#fd7e14' };

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

describe('EditTagPopover', () => {
  test('closes only after the edited tag is persisted', async () => {
    let resolveSave: (() => void) | undefined;
    const editTagCallback = vi.fn(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));
    render(
      <MantineProvider>
        <EditTagPopover tag={tag} currentNames={[tag.name]} editTagCallback={editTagCallback} />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Original Tag' }));
    const nameInput = await screen.findByPlaceholderText('Enter tag name');
    fireEvent.change(nameInput, { target: { value: 'Updated Tag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Tag' }));

    expect(screen.getByPlaceholderText('Enter tag name')).toBeDefined();
    expect(editTagCallback).toHaveBeenCalledWith(tag, expect.objectContaining({
      id: tag.id,
      name: 'Updated Tag',
    }));
    await act(async () => {
      resolveSave?.();
    });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Enter tag name')).toBeNull();
    });
  });

  test('keeps the edit popover open when persistence fails', async () => {
    const editTagCallback = vi.fn().mockRejectedValue(new Error('save failed'));
    render(
      <MantineProvider>
        <EditTagPopover tag={tag} currentNames={[tag.name]} editTagCallback={editTagCallback} />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Original Tag' }));
    fireEvent.change(await screen.findByPlaceholderText('Enter tag name'), { target: { value: 'Updated Tag' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Tag' }));

    expect(await screen.findByText('Unable to save tag. Try again.')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter tag name')).toBeDefined();
  });
});
