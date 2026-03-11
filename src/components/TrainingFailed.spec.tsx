import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { TrainingFailed } from './TrainingFailed';

const mockStorageEngine = {
  rejectCurrentParticipant: vi.fn(async () => {}),
};

vi.mock('../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

describe('TrainingFailed', () => {
  it('renders failed training message', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TrainingFailed />
      </MantineProvider>,
    );
    expect(html).toContain('you are not eligible to participate in the study');
  });
});
