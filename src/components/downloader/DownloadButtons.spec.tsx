import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { DownloadButtons } from './DownloadButtons';

vi.mock('@mantine/hooks', () => ({
  useDisclosure: () => [false, { open: vi.fn(), close: vi.fn() }],
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: {} }),
}));

vi.mock('./DownloadTidy', () => ({
  DownloadTidy: () => <div>download-tidy</div>,
  download: vi.fn(),
}));

vi.mock('../../utils/handleDownloadFiles', () => ({
  downloadParticipantsAudioZip: vi.fn(),
  downloadParticipantsScreenRecordingZip: vi.fn(),
}));

describe('DownloadButtons', () => {
  it('renders json and csv download buttons by default', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <DownloadButtons
          visibleParticipants={[]}
          studyId="study-a"
        />
      </MantineProvider>,
    );

    expect((html.match(/<button/g) || []).length).toBe(2);
  });

  it('renders audio and screen recording buttons when enabled', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <DownloadButtons
          visibleParticipants={async () => []}
          studyId="study-a"
          hasAudio
          hasScreenRecording
        />
      </MantineProvider>,
    );

    expect((html.match(/<button/g) || []).length).toBe(4);
  });
});
