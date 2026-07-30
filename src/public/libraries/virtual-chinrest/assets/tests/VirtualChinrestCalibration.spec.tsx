import { ReactNode } from 'react';
import { render, waitFor } from '@testing-library/react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import VirtualChinrestCalibration from '../VirtualChinrestCalibration';
import { findPreviousCardSizeAnswer } from '../ViewingDistanceCalibration';

const mockStoredAnswer = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock('@mantine/core', () => ({
  Slider: ({ disabled, value }: { disabled?: boolean, value?: number }) => (
    <div data-testid="slider" data-disabled={disabled} data-value={value} />
  ),
  Button: ({ children, disabled }: { children?: ReactNode, disabled?: boolean }) => (
    <button type="button" disabled={disabled}>{children}</button>
  ),
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => true,
}));

vi.mock('../../../../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: () => mockStoredAnswer.value,
}));

describe('VirtualChinrestCalibration replay', () => {
  beforeEach(() => {
    mockStoredAnswer.value = {
      componentName: '$virtual-chinrest.components.card-size',
      trialOrder: '2',
      answer: { pixelsPerMM: 5 },
    };
  });

  test('rehydrates the saved calibration and keeps analysis controls read-only', async () => {
    const { getByRole, getByTestId, getByText } = render(
      <VirtualChinrestCalibration
        parameters={{ taskid: 'pixelsPerMM' }}
        itemWidthMM={85.6}
        itemHeightMM={53.98}
        fixedCorner="top-left"
        answers={{
          cardSize_0: {
            componentName: '$virtual-chinrest.components.card-size',
            answer: { pixelsPerMM: 4 },
          },
        } as never}
        setAnswer={vi.fn()}
        useTrrack={vi.fn() as never}
      />,
    );

    await waitFor(() => expect(getByTestId('slider').getAttribute('data-value')).toBe('428'));
    expect(getByTestId('slider').getAttribute('data-disabled')).toBe('true');
    expect((getByRole('button', { name: 'Confirm Size' }) as HTMLButtonElement).disabled).toBe(true);
    expect(getByText(/Calibration Complete/)).toBeDefined();
    expect(getByText(/5.00/)).toBeDefined();
  });

  test('selects the closest preceding card calibration for repeated library sequences', () => {
    const closestCard = findPreviousCardSizeAnswer({
      card_0: {
        componentName: '$virtual-chinrest.components.card-size',
        trialOrder: '9_4',
        answer: { pixelsPerMM: 2 },
      },
      distance_1: {
        componentName: '$virtual-chinrest.components.blindspot-distance',
        trialOrder: '9_5',
        answer: { 'dist-calibration-MM': 400 },
      },
      card_2: {
        componentName: '$virtual-chinrest.components.card-size',
        trialOrder: '10_0',
        answer: { pixelsPerMM: 5 },
      },
      distance_3: {
        componentName: '$virtual-chinrest.components.blindspot-distance',
        trialOrder: '10_1',
        answer: { 'dist-calibration-MM': 500 },
      },
    } as never, '10_1');

    expect(closestCard?.answer.pixelsPerMM).toBe(5);
  });
});
