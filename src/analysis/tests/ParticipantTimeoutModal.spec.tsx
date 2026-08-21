import { ReactNode } from 'react';
import {
  act, cleanup, fireEvent, render, screen,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import {
  formatElapsedTime, getInProgressParticipantsByElapsedTime, ParticipantTimeoutModal,
} from '../individualStudy/ParticipantTimeoutModal';
import { makeParticipant } from '../../tests/utils';

let mockUser: { isAdmin: boolean };
let mockStorageEngine: { rejectParticipant: ReturnType<typeof vi.fn> } | undefined;

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../../store/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('@mantine/core', () => ({
  Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    children, onClick, disabled, loading,
  }: { children: ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled || loading}>{children}</button>
  ),
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Modal: ({ opened, children, title }: { opened: boolean; children: ReactNode; title: ReactNode }) => (
    opened ? (
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null
  ),
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconClockOff: () => <span>clock</span>,
}));

describe('ParticipantTimeoutModal', () => {
  beforeEach(() => {
    mockUser = { isAdmin: true };
    mockStorageEngine = { rejectParticipant: vi.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('lists only in-progress participants from longest to shortest', () => {
    const participants = getInProgressParticipantsByElapsedTime([
      makeParticipant({ participantId: 'completed', createdTime: 100, completed: true }),
      makeParticipant({ participantId: 'rejected', createdTime: 100, rejected: { reason: 'test', timestamp: 1 } }),
      makeParticipant({ participantId: 'short', createdTime: 900 }),
      makeParticipant({ participantId: 'long', createdTime: 100 }),
    ], 1000);

    expect(participants.map((participant) => participant.participantId)).toEqual(['long', 'short']);
    expect(participants.map((participant) => participant.elapsedTime)).toEqual([900, 100]);
  });

  test('formats elapsed time with days, hours, and minutes', () => {
    expect(formatElapsedTime((((3 * 24 + 7) * 60 + 40) * 60_000))).toBe('3d 7h 40m');
    expect(formatElapsedTime(2 * 60 * 60_000)).toBe('2h 0m');
    expect(formatElapsedTime(45 * 60_000)).toBe('45m');
  });

  test('opens the review modal and times out the chosen participant', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      render(<ParticipantTimeoutModal participants={[makeParticipant({ participantId: 'p1', participantIndex: 2, createdTime: Date.now() - 1000 })]} refresh={refresh} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Review In-Progress Participants (1)' }));
    });
    expect(screen.getByText('In-Progress Participants')).toBeDefined();
    expect(screen.getByText('p1')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Time Out' }));
    });
    expect(mockStorageEngine!.rejectParticipant).toHaveBeenCalledWith('p1', 'Timed out by admin');
    expect(refresh).toHaveBeenCalledOnce();
  });

  test('disables the review button for non-admins', () => {
    mockUser = { isAdmin: false };
    render(<ParticipantTimeoutModal participants={[makeParticipant({ createdTime: 1 })]} refresh={vi.fn()} />);

    expect((screen.getByRole('button', { name: 'Review In-Progress Participants (1)' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
