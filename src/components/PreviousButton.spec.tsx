import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { PreviousButton } from './PreviousButton';

vi.mock('../store/hooks/usePreviousStep', () => ({
  usePreviousStep: () => ({ isPreviousDisabled: false, goToPreviousStep: vi.fn() }),
}));

vi.mock('../store/store', () => ({
  useStoreDispatch: () => vi.fn(),
  useStoreActions: () => ({ setClickedPrevious: (value: boolean) => value }),
}));

describe('PreviousButton', () => {
  it('renders with default and custom labels', () => {
    const defaultHtml = renderToStaticMarkup(
      <MantineProvider>
        <PreviousButton />
      </MantineProvider>,
    );
    const customHtml = renderToStaticMarkup(
      <MantineProvider>
        <PreviousButton label="Go Back" px={12} />
      </MantineProvider>,
    );

    expect(defaultHtml).toContain('Previous');
    expect(customHtml).toContain('Go Back');
  });
});
