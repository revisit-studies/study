import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, screen, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { DownloadButtons } from './DownloadButtons';
import { download } from './DownloadTidy';
import { downloadParticipantsAudioZip, downloadParticipantsScreenRecordingZip } from '../../utils/handleDownloadFiles';
import type { ParticipantData } from '../../storage/types';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: { getEngine: () => 'supabase' } }),
}));

vi.mock('@mantine/hooks', () => ({
  useDisclosure: () => [false, { open: vi.fn(), close: vi.fn() }],
}));

vi.mock('./DownloadTidy', () => ({
  DownloadTidy: () => <div data-testid="download-tidy" />,
  download: vi.fn(),
}));

vi.mock('../../utils/handleDownloadFiles', () => ({
  downloadParticipantsAudioZip: vi.fn().mockResolvedValue(undefined),
  downloadParticipantsScreenRecordingZip: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@mantine/core', () => ({
  Button: ({
    children, disabled, loading, onClick,
  }: { children: ReactNode; disabled?: boolean; loading?: boolean; onClick?: () => void }) => (
    <button type="button" disabled={disabled} data-loading={loading} onClick={onClick}>{children}</button>
  ),
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children, label }: { children: ReactNode; label?: string }) => (
    <div title={label}>{children}</div>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconDatabaseExport: () => <span>json-icon</span>,
  IconDeviceDesktopDown: () => <span>screen-icon</span>,
  IconMusicDown: () => <span>audio-icon</span>,
  IconTableExport: () => <span>tidy-icon</span>,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const baseProps = {
  studyId: 'test-study',
  visibleParticipants: [] as ParticipantData[],
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('DownloadButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('always renders JSON download button', () => {
    const html = renderToStaticMarkup(<DownloadButtons {...baseProps} />);
    expect(html).toContain('json-icon');
  });

  test('always renders tidy CSV download button', () => {
    const html = renderToStaticMarkup(<DownloadButtons {...baseProps} />);
    expect(html).toContain('tidy-icon');
  });

  test('does not render audio button when hasAudio is false', () => {
    const html = renderToStaticMarkup(<DownloadButtons {...baseProps} hasAudio={false} />);
    expect(html).not.toContain('audio-icon');
  });

  test('renders audio button when hasAudio is true', () => {
    const html = renderToStaticMarkup(<DownloadButtons {...baseProps} hasAudio />);
    expect(html).toContain('audio-icon');
  });

  test('does not render screen recording button when hasScreenRecording is false', () => {
    const html = renderToStaticMarkup(<DownloadButtons {...baseProps} hasScreenRecording={false} />);
    expect(html).not.toContain('screen-icon');
  });

  test('renders screen recording button when hasScreenRecording is true', () => {
    const html = renderToStaticMarkup(<DownloadButtons {...baseProps} hasScreenRecording />);
    expect(html).toContain('screen-icon');
  });

  test('buttons are disabled when participant list is empty', () => {
    const html = renderToStaticMarkup(<DownloadButtons {...baseProps} />);
    expect(html).toContain('disabled');
  });

  test('buttons are enabled when participant list is non-empty', () => {
    const props = {
      ...baseProps,
      visibleParticipants: [{ participantId: 'p1' } as ParticipantData],
    };
    const html = renderToStaticMarkup(<DownloadButtons {...props} />);
    expect(html).not.toContain('disabled=""');
  });

  test('tooltip shows count for array participants', () => {
    const props = {
      ...baseProps,
      visibleParticipants: [{ participantId: 'p1' } as ParticipantData, { participantId: 'p2' } as ParticipantData],
    };
    const html = renderToStaticMarkup(<DownloadButtons {...props} />);
    expect(html).toContain('Download 2 participants');
  });

  test('accepts a function as visibleParticipants', () => {
    const fetchFn = vi.fn().mockResolvedValue([]);
    const html = renderToStaticMarkup(
      <DownloadButtons {...baseProps} visibleParticipants={fetchFn} />,
    );
    expect(html).toContain('json-icon');
    expect(html).toContain('Download participants data');
  });
});

// ── interactive tests (click handlers) ────────────────────────────────────────

const participant = {
  participantId: 'p1',
  answers: { trial_0: { endTime: 1000, startTime: 0 } },
} as unknown as ParticipantData;

describe('DownloadButtons click handlers', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('JSON button click calls download with participant JSON', async () => {
    await act(async () => {
      render(
        <DownloadButtons
          studyId="test-study"
          visibleParticipants={[participant]}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button')[0]);
    });

    expect(vi.mocked(download)).toHaveBeenCalledWith(
      expect.stringContaining('p1'),
      'test-study_all.json',
    );
  });

  test('JSON button uses custom fileName when provided', async () => {
    await act(async () => {
      render(
        <DownloadButtons
          studyId="test-study"
          visibleParticipants={[participant]}
          fileName="custom"
        />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button')[0]);
    });

    expect(vi.mocked(download)).toHaveBeenCalledWith(
      expect.any(String),
      'custom.json',
    );
  });

  test('audio button click calls downloadParticipantsAudioZip', async () => {
    await act(async () => {
      render(
        <DownloadButtons
          studyId="test-study"
          visibleParticipants={[participant]}
          hasAudio
        />,
      );
    });

    // buttons: [json, tidy, audio]
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button')[2]);
    });

    expect(vi.mocked(downloadParticipantsAudioZip)).toHaveBeenCalledWith(
      expect.objectContaining({ studyId: 'test-study' }),
    );
  });

  test('screen recording button click calls downloadParticipantsScreenRecordingZip', async () => {
    await act(async () => {
      render(
        <DownloadButtons
          studyId="test-study"
          visibleParticipants={[participant]}
          hasScreenRecording
        />,
      );
    });

    // buttons: [json, tidy, screen]
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button')[2]);
    });

    expect(vi.mocked(downloadParticipantsScreenRecordingZip)).toHaveBeenCalledWith(
      expect.objectContaining({ studyId: 'test-study' }),
    );
  });

  test('visibleParticipants as function is called when JSON button clicked', async () => {
    const fetchFn = vi.fn().mockResolvedValue([participant]);

    await act(async () => {
      render(
        <DownloadButtons
          studyId="test-study"
          visibleParticipants={fetchFn}
        />,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button')[0]);
    });

    expect(fetchFn).toHaveBeenCalled();
    expect(vi.mocked(download)).toHaveBeenCalled();
  });
});
