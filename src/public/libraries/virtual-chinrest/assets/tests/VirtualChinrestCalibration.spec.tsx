import { ReactNode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import VirtualChinrestCalibration from '../VirtualChinrestCalibration';

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

describe('VirtualChinrestCalibration replay', () => {
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

    await waitFor(() => expect(getByTestId('slider').getAttribute('data-value')).toBe('342.4'));
    expect(getByTestId('slider').getAttribute('data-disabled')).toBe('true');
    expect((getByRole('button', { name: 'Confirm Size' }) as HTMLButtonElement).disabled).toBe(true);
    expect(getByText(/Calibration Complete/)).toBeDefined();
    expect(getByText(/4.00/)).toBeDefined();
  });
});
