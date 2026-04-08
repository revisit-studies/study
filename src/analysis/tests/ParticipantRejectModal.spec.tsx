import { ReactNode } from 'react';
import {
  render, act, cleanup, screen, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ParticipantRejectModal } from '../individualStudy/ParticipantRejectModal';
import { ParticipantData } from '../../storage/types';

let mockUser: { isAdmin: boolean };
let mockStorageEngine: {
  getParticipantData: ReturnType<typeof vi.fn>;
  rejectParticipant: ReturnType<typeof vi.fn>;
  undoRejectParticipant: ReturnType<typeof vi.fn>;
} | undefined;
let mockSearchParams = new URLSearchParams();

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../../store/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('react-router', () => ({
  useParams: () => ({ studyId: 'test-study' }),
  useSearchParams: () => [mockSearchParams],
}));

vi.mock('@mantine/core', () => ({
  Modal: ({ opened, children, title }: { opened: boolean; children: ReactNode; title?: ReactNode }) => (
    opened ? (
      <div>
        {title}
        {children}
      </div>
    ) : null
  ),
  Button: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
  TextInput: ({ onChange, label }: { onChange?: React.ChangeEventHandler<HTMLInputElement>; label?: ReactNode }) => (
    <div>
      <label>
        {label}
        <input onChange={onChange} />
      </label>
    </div>
  ),
  Alert: ({ children, title }: { children: ReactNode; title?: ReactNode }) => (
    <div role="alert">
      {title}
      {children}
    </div>
  ),
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertTriangle: () => <span>warning</span>,
}));

const makeParticipant = (participantId: string, rejected: ParticipantData['rejected'] = false): ParticipantData => ({
  participantId,
  participantConfigHash: 'hash',
  sequence: {} as ParticipantData['sequence'],
  participantIndex: 0,
  answers: {},
  searchParams: {},
  metadata: {} as ParticipantData['metadata'],
  completed: false,
  rejected,
  participantTags: [],
  stage: 'DEFAULT',
});

describe('ParticipantRejectModal', () => {
  beforeEach(() => {
    mockUser = { isAdmin: true };
    mockSearchParams = new URLSearchParams();
    mockStorageEngine = {
      getParticipantData: vi.fn().mockResolvedValue(null),
      rejectParticipant: vi.fn().mockResolvedValue(undefined),
      undoRejectParticipant: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('shows Reject button for non-rejected participant', async () => {
    const participants = [makeParticipant('p1')];
    await act(async () => {
      render(<ParticipantRejectModal selectedParticipants={participants} />);
    });
    expect(screen.getByRole('button', { name: /Reject Participants \(1\)/ })).toBeDefined();
  });

  test('shows Undo Reject button for rejected participant', async () => {
    const participants = [makeParticipant('p1', { reason: 'test', timestamp: 0 })];
    await act(async () => {
      render(<ParticipantRejectModal selectedParticipants={participants} />);
    });
    expect(screen.getByRole('button', { name: /Undo Reject Participants \(1\)/ })).toBeDefined();
  });

  test('shows both buttons when participants have mixed rejected status', async () => {
    const participants = [
      makeParticipant('p1'),
      makeParticipant('p2', { reason: 'test', timestamp: 0 }),
    ];
    await act(async () => {
      render(<ParticipantRejectModal selectedParticipants={participants} />);
    });
    expect(screen.getByRole('button', { name: /Undo Reject/ })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reject Participants (1)' })).toBeDefined();
  });

  test('Reject button is disabled when user is not admin', async () => {
    mockUser = { isAdmin: false };
    const participants = [makeParticipant('p1')];
    await act(async () => {
      render(<ParticipantRejectModal selectedParticipants={participants} />);
    });
    const btn = screen.getByRole('button', { name: /Reject Participants \(1\)/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  test('opens reject modal when Reject button clicked', async () => {
    const participants = [makeParticipant('p1')];
    await act(async () => {
      render(<ParticipantRejectModal selectedParticipants={participants} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Reject Participants \(1\)/ }));
    });
    expect(screen.getByText(/When participants are rejected/)).toBeDefined();
  });

  test('calls rejectParticipant when reject confirmed', async () => {
    const participants = [makeParticipant('p1')];
    await act(async () => {
      render(<ParticipantRejectModal selectedParticipants={participants} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Reject Participants \(1\)/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reject Participants' }));
    });
    expect(mockStorageEngine!.rejectParticipant).toHaveBeenCalledWith('p1', 'Rejected by admin');
  });

  test('opens undo reject modal when Undo Reject clicked', async () => {
    const participants = [makeParticipant('p1', { reason: 'test', timestamp: 0 })];
    await act(async () => {
      render(<ParticipantRejectModal selectedParticipants={participants} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Undo Reject Participants \(1\)/ }));
    });
    expect(screen.getByText('Are you sure you want to undo the rejection of these participants?')).toBeDefined();
  });

  test('calls undoRejectParticipant when undo confirmed', async () => {
    const participants = [makeParticipant('p1', { reason: 'done', timestamp: 0 })];
    await act(async () => {
      render(<ParticipantRejectModal selectedParticipants={participants} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Undo Reject Participants \(1\)/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo Reject Participants' }));
    });
    expect(mockStorageEngine!.undoRejectParticipant).toHaveBeenCalledWith('p1');
  });
});
