import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { NextButton } from './NextButton';

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../store/hooks/useNextStep', () => ({
  useNextStep: () => ({ isNextDisabled: false, goToNextStep: vi.fn() }),
}));

vi.mock('../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => ({
    uiConfig: {
      nextButtonDisableTime: 0,
      nextButtonEnableTime: 0,
      nextOnEnter: false,
      timeoutReject: false,
      previousButtonText: 'Previous',
    },
  }),
}));

vi.mock('./PreviousButton', () => ({
  PreviousButton: ({ label }: { label?: string }) => <button type="button">{label || 'Previous'}</button>,
}));

describe('NextButton', () => {
  it('renders next control and check answer content', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <NextButton
          label="Continue"
          location="sidebar"
          checkAnswer={<div>check-answer</div>}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Continue');
    expect(html).toContain('check-answer');
  });
});
