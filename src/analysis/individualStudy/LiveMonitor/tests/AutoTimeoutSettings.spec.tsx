import { ReactNode } from 'react';
import {
  act, cleanup, fireEvent, render, screen,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StorageEngine } from '../../../../storage/engines/types';
import { AutoTimeoutSettings } from '../AutoTimeoutSettings';

let mockUser: { isAdmin: boolean };

vi.mock('../../../../store/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('@mantine/core', () => ({
  Alert: ({ title, children }: { title?: ReactNode; children: ReactNode }) => (
    <div>
      <strong>{title}</strong>
      {children}
    </div>
  ),
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Modal: ({ opened, title, children }: { opened: boolean; title: ReactNode; children: ReactNode }) => (
    opened ? (
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null
  ),
  NumberInput: ({
    value, disabled, onChange, onBlur, 'aria-label': ariaLabel,
  }: {
    value: number;
    disabled?: boolean;
    onChange?: (value: number) => void;
    onBlur?: () => void;
    'aria-label': string;
  }) => (
    <input
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange?.(Number(event.target.value))}
      onBlur={onBlur}
    />
  ),
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Switch: ({
    checked, disabled, onChange, 'aria-label': ariaLabel,
  }: {
    checked: boolean;
    disabled?: boolean;
    onChange?: (event: { currentTarget: { checked: boolean } }) => void;
    'aria-label': string;
  }) => (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange?.({ currentTarget: { checked: event.target.checked } })}
    />
  ),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Title: ({ children }: { children: ReactNode }) => <h5>{children}</h5>,
}));

function makeEngine(overrides: Partial<{
  getModes: ReturnType<typeof vi.fn>;
  setAutoTimeoutMinutes: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getModes: vi.fn().mockResolvedValue({ autoTimeoutMinutes: undefined }),
    setAutoTimeoutMinutes: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as StorageEngine & {
    getModes: ReturnType<typeof vi.fn>;
    setAutoTimeoutMinutes: ReturnType<typeof vi.fn>;
  };
}

async function renderSettings(engine: ReturnType<typeof makeEngine>) {
  await act(async () => {
    render(<AutoTimeoutSettings storageEngine={engine} studyId="test-study" />);
  });
  return {
    minutesInput: screen.getByLabelText('Auto-timeout minutes') as HTMLInputElement,
    toggle: screen.getByLabelText('Enable auto-timeout') as HTMLInputElement,
  };
}

beforeEach(() => { mockUser = { isAdmin: true }; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('AutoTimeoutSettings', () => {
  test('shows the stored minutes and an enabled toggle', async () => {
    const engine = makeEngine({ getModes: vi.fn().mockResolvedValue({ autoTimeoutMinutes: 30 }) });
    const { minutesInput, toggle } = await renderSettings(engine);

    expect(minutesInput.value).toBe('30');
    expect(toggle.checked).toBe(true);
    expect(toggle.disabled).toBe(false);
  });

  test('blurring the minutes input without changing it does not save', async () => {
    // Saving on every blur used to disable the toggle just as a click on it
    // landed, swallowing the first attempt to turn auto-timeout off.
    const engine = makeEngine({ getModes: vi.fn().mockResolvedValue({ autoTimeoutMinutes: 30 }) });
    const { minutesInput } = await renderSettings(engine);

    await act(async () => { fireEvent.blur(minutesInput); });

    expect(engine.setAutoTimeoutMinutes).not.toHaveBeenCalled();
  });

  test('blurring the minutes input after a change saves the new value', async () => {
    const engine = makeEngine({ getModes: vi.fn().mockResolvedValue({ autoTimeoutMinutes: 30 }) });
    const { minutesInput } = await renderSettings(engine);

    await act(async () => { fireEvent.change(minutesInput, { target: { value: '45' } }); });
    await act(async () => { fireEvent.blur(minutesInput); });

    expect(engine.setAutoTimeoutMinutes).toHaveBeenCalledWith('test-study', 45);
  });

  test('turning the toggle off disables auto-timeout', async () => {
    const engine = makeEngine({ getModes: vi.fn().mockResolvedValue({ autoTimeoutMinutes: 30 }) });
    const { toggle } = await renderSettings(engine);

    await act(async () => { fireEvent.click(toggle); });

    expect(engine.setAutoTimeoutMinutes).toHaveBeenCalledWith('test-study', undefined);
  });

  test('turning the toggle on asks for confirmation before saving', async () => {
    const engine = makeEngine();
    const { toggle } = await renderSettings(engine);

    await act(async () => { fireEvent.click(toggle); });
    expect(engine.setAutoTimeoutMinutes).not.toHaveBeenCalled();
    expect(screen.getByText('Enable auto-timeout?')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enable auto-timeout' }));
    });
    expect(engine.setAutoTimeoutMinutes).toHaveBeenCalledWith('test-study', 60);
  });

  test('a failed read leaves the controls disabled and offers a retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { });
    const getModes = vi.fn()
      .mockRejectedValueOnce(new Error('settings unavailable'))
      .mockResolvedValue({ autoTimeoutMinutes: 15 });
    const engine = makeEngine({ getModes });
    const { toggle } = await renderSettings(engine);

    expect(screen.getByText('The auto-timeout setting could not be loaded.')).toBeDefined();
    expect(toggle.disabled).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(getModes).toHaveBeenCalledTimes(2);
    expect((screen.getByLabelText('Auto-timeout minutes') as HTMLInputElement).value).toBe('15');
    expect((screen.getByLabelText('Enable auto-timeout') as HTMLInputElement).disabled).toBe(false);
  });

  test('a failed save rolls the controls back to the stored value', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { });
    const engine = makeEngine({
      getModes: vi.fn().mockResolvedValue({ autoTimeoutMinutes: 30 }),
      setAutoTimeoutMinutes: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    });
    const { toggle } = await renderSettings(engine);

    await act(async () => { fireEvent.click(toggle); });

    expect(screen.getByText('The auto-timeout setting could not be saved.')).toBeDefined();
    expect((screen.getByLabelText('Enable auto-timeout') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Auto-timeout minutes') as HTMLInputElement).value).toBe('30');
  });

  test('non-admins cannot change the setting', async () => {
    mockUser = { isAdmin: false };
    const engine = makeEngine({ getModes: vi.fn().mockResolvedValue({ autoTimeoutMinutes: 30 }) });
    const { minutesInput, toggle } = await renderSettings(engine);

    expect(minutesInput.disabled).toBe(true);
    expect(toggle.disabled).toBe(true);
    expect(screen.getByText('Only study administrators can change auto-timeout.')).toBeDefined();
  });
});
