import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { StyleView } from '../StyleView';

describe('StyleView', () => {
  test('renders placeholders for the planned style settings', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <StyleView studyId="test-study" />
      </MantineProvider>,
    );

    expect(html).toContain('Style settings for test-study');
    expect(html).toContain('Light / dark mode');
  });
});
