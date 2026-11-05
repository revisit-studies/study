import { render, waitFor } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { ReactNode } from 'react';
import { StartupInteractionProvider } from '../StartupContext';
import { TrainingFailed } from '../TrainingFailed';
import { useStorageEngine } from '../../storage/storageEngineHooks';

const mockReject = vi.fn(() => Promise.resolve());

vi.mock('@mantine/core', () => ({
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: vi.fn(() => ({
    storageEngine: { rejectCurrentParticipant: mockReject },
  })),
}));

afterEach(() => vi.clearAllMocks());

describe('TrainingFailed', () => {
  test('renders the training-failed message', () => {
    const { container, unmount } = render(<TrainingFailed />);
    expect(container.textContent).toContain("you didn't answer the training correctly");
    unmount();
  });

  test('calls rejectCurrentParticipant with the correct reason on mount', async () => {
    const { unmount } = render(<TrainingFailed />);
    await waitFor(() => expect(mockReject).toHaveBeenCalledWith('Failed training'));
    unmount();
  });

  test('defers rejection until participant startup is ready', async () => {
    const { rerender, unmount } = render(
      <StartupInteractionProvider value><TrainingFailed /></StartupInteractionProvider>,
    );
    expect(mockReject).not.toHaveBeenCalled();
    rerender(<StartupInteractionProvider value={false}><TrainingFailed /></StartupInteractionProvider>);
    await waitFor(() => expect(mockReject).toHaveBeenCalledWith('Failed training'));
    unmount();
  });

  test('does not throw when storageEngine is undefined', async () => {
    vi.mocked(useStorageEngine).mockReturnValueOnce({
      storageEngine: undefined,
    } as ReturnType<typeof useStorageEngine>);
    const { unmount } = render(<TrainingFailed />);
    expect(mockReject).not.toHaveBeenCalled();
    unmount();
  });
});
