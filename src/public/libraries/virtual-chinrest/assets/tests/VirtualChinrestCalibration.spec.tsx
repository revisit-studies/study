import { ReactNode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import VirtualChinrestCalibration from '../VirtualChinrestCalibration';
import ViewingDistanceCalibration, { findPreviousCardSizeAnswer } from '../ViewingDistanceCalibration';

const mockStoredAnswer = vi.hoisted(() => ({ value: undefined as unknown }));
const mockAnswers = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const mockApply = vi.hoisted(() => vi.fn());
const mockIsAnalysis = vi.hoisted(() => ({ value: true }));

vi.mock('@trrack/core', () => ({
  Registry: {
    create: () => ({
      register: () => vi.fn(),
    }),
  },
}));

vi.mock('@mantine/core', () => {
  const List = Object.assign(
    ({ children }: { children?: ReactNode }) => <ul>{children}</ul>,
    { Item: ({ children }: { children?: ReactNode }) => <li>{children}</li> },
  );
  return {
    Slider: ({ disabled, value }: { disabled?: boolean, value?: number }) => (
      <div data-testid="slider" data-disabled={disabled} data-value={value} />
    ),
    Button: ({ children, disabled, onClick }: { children?: ReactNode, disabled?: boolean, onClick?: () => void }) => (
      <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
    ),
    Container: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    List,
    Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('../../../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis.value,
}));

vi.mock('../../../../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: () => mockStoredAnswer.value,
}));

vi.mock('../../../../../store/store', () => ({
  useStoreSelector: (selector: (state: { answers: Record<string, unknown> }) => unknown) => selector({ answers: mockAnswers.value }),
}));

const mockUseTrrack = vi.fn(({ initialState }: { initialState: unknown }) => ({ apply: mockApply, getState: () => initialState, currentChange: () => () => true }));
const useTrrack = mockUseTrrack as never;

describe('VirtualChinrestCalibration replay', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockApply.mockReset();
    mockUseTrrack.mockClear();
    mockIsAnalysis.value = true;
    mockStoredAnswer.value = {
      componentName: '$virtual-chinrest.components.card-size',
      trialOrder: '2',
      answer: { pixelsPerMM: 5 },
    };
    mockAnswers.value = {};
  });

  test('seeds a legacy saved calibration into the new graph instead of graph defaults', () => {
    mockIsAnalysis.value = false;
    render(<VirtualChinrestCalibration
      store={{}} registerGlobalStoreUpdater={() => () => undefined} parameters={{ taskid: 'pixelsPerMM' }}
      itemWidthMM={85.6}
      itemHeightMM={53.98}
      fixedCorner="top-left"
      answers={{}}
      setAnswer={vi.fn()}
      useTrrack={useTrrack}
    />);
    expect(mockUseTrrack.mock.calls[0][0].initialState).toEqual({ itemWidthPx: 428, isCalibrationComplete: true });
    expect(mockApply).not.toHaveBeenCalled();
  });

  test('seeds legacy viewing-distance answers without inventing measurement events', () => {
    mockIsAnalysis.value = false;
    mockStoredAnswer.value = {
      componentName: '$virtual-chinrest.components.viewing-distance', trialOrder: '3',
      answer: { 'dist-calibration-MM': 600, 'ball-positions': '[400,350]' },
    };
    render(<ViewingDistanceCalibration store={{}} registerGlobalStoreUpdater={() => () => undefined} parameters={{ blindspotAngle: 13.5 }} answers={{}} setAnswer={vi.fn()} useTrrack={useTrrack} />);
    expect(mockUseTrrack.mock.calls[0][0].initialState).toEqual({ ballPosition: 350, ballPositions: [400, 350], viewingDistance: 600 });
    expect(mockApply).not.toHaveBeenCalled();
  });

  test('keeps the retained graph ahead of older saved answers', () => {
    mockIsAnalysis.value = false;
    mockUseTrrack.mockImplementationOnce(() => ({
      apply: mockApply,
      getState: () => ({ itemWidthPx: 370, isCalibrationComplete: false }),
      currentChange: () => () => true,
    }));
    const card = render(<VirtualChinrestCalibration
      store={{}} registerGlobalStoreUpdater={() => () => undefined} parameters={{ taskid: 'pixelsPerMM' }} itemWidthMM={85.6} itemHeightMM={53.98} fixedCorner="top-left"
      answers={{}} setAnswer={vi.fn()} useTrrack={useTrrack}
    />);
    expect(card.getByTestId('slider').getAttribute('data-value')).toBe('370');
    expect(card.queryByText(/Calibration Complete/)).toBeNull();
    card.unmount();
    mockAnswers.value = {
      card: { componentName: '$virtual-chinrest.components.card-size', trialOrder: '1', answer: { pixelsPerMM: 5 } },
    };
    mockStoredAnswer.value = { trialOrder: '2', answer: { 'dist-calibration-MM': 600, 'ball-positions': '[400,350,300,250,200]' } };
    mockUseTrrack.mockImplementationOnce(() => ({
      apply: mockApply,
      getState: () => ({ ballPosition: 350, ballPositions: [400, 350], viewingDistance: null }),
      currentChange: () => () => true,
    }));
    const distance = render(<ViewingDistanceCalibration store={{}} registerGlobalStoreUpdater={() => () => undefined} parameters={{ blindspotAngle: 13.5 }} answers={{}} setAnswer={vi.fn()} useTrrack={useTrrack} />);
    expect(distance.getByText(/Remaining measurements:/).textContent).toContain('3');
    expect(distance.getByTestId('blindspot-ball').style.left).toBe('740px');
    expect(mockUseTrrack.mock.results.at(-1)?.value.getState()).toEqual({ ballPosition: 350, ballPositions: [400, 350], viewingDistance: null });
    expect(mockApply).not.toHaveBeenCalled();
  });

  test('rehydrates the saved calibration and keeps analysis controls read-only', async () => {
    const { getByRole, getByTestId, getByText } = render(
      <VirtualChinrestCalibration
        store={{}} registerGlobalStoreUpdater={() => () => undefined} parameters={{ taskid: 'pixelsPerMM' }}
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
        useTrrack={useTrrack}
      />,
    );

    await waitFor(() => expect(getByTestId('slider').getAttribute('data-value')).toBe('428'));
    expect(getByTestId('slider').getAttribute('data-disabled')).toBe('true');
    expect((getByRole('button', { name: 'Confirm Size' }) as HTMLButtonElement).disabled).toBe(true);
    expect(getByText(/Calibration Complete/)).toBeDefined();
    expect(getByText(/5.00/)).toBeDefined();
  });

  test('replays card-size adjustments from provenance state', async () => {
    const props = {
      store: {}, registerGlobalStoreUpdater: () => () => undefined,
      parameters: { taskid: 'pixelsPerMM' },
      itemWidthMM: 85.6,
      itemHeightMM: 53.98,
      fixedCorner: 'top-left' as const,
      answers: {},
      setAnswer: vi.fn(),
      useTrrack,
    };
    const { getByTestId, queryByText, rerender } = render(
      <VirtualChinrestCalibration
        {...props}
        provenanceState={{ itemWidthPx: 250, isCalibrationComplete: false }}
      />,
    );

    await waitFor(() => expect(getByTestId('slider').getAttribute('data-value')).toBe('250'));
    expect(queryByText(/Calibration Complete/)).toBeNull();

    rerender(
      <VirtualChinrestCalibration
        {...props}
        provenanceState={{ itemWidthPx: 420, isCalibrationComplete: true }}
      />,
    );
    await waitFor(() => expect(getByTestId('slider').getAttribute('data-value')).toBe('420'));
    expect(queryByText(/Calibration Complete/)).not.toBeNull();
  });

  test('replays each viewing-distance measurement from provenance state', async () => {
    mockIsAnalysis.value = false;
    mockStoredAnswer.value = {
      componentName: '$virtual-chinrest.components.blindspot-distance',
      trialOrder: '10_1',
      answer: { 'dist-calibration-MM': 500 },
    };
    mockAnswers.value = {
      card: {
        componentName: '$virtual-chinrest.components.card-size',
        trialOrder: '10_0',
        answer: { pixelsPerMM: 5 },
      },
    };
    const props = {
      store: {}, registerGlobalStoreUpdater: () => () => undefined,
      parameters: { blindspotAngle: 13.5 },
      answers: {},
      setAnswer: vi.fn(),
      useTrrack,
    };
    const { getByRole, getByText, rerender } = render(
      <ViewingDistanceCalibration
        {...props}
        provenanceState={{ ballPosition: 600, ballPositions: [600], viewingDistance: null }}
      />,
    );

    await waitFor(() => expect(getByText(/Remaining measurements:/).textContent).toContain('4'));

    rerender(
      <ViewingDistanceCalibration
        {...props}
        provenanceState={{
          ballPosition: 400,
          ballPositions: [600, 550, 500, 450, 400],
          viewingDistance: 500,
        }}
      />,
    );
    await waitFor(() => expect(getByText(/Remaining measurements:/).textContent).toContain('0'));
    expect(getByText(/50.0/)).toBeDefined();

    getByRole('button', { name: 'Retake' }).click();
    await waitFor(() => expect(getByText(/Remaining measurements:/).textContent).toContain('5'));
    expect(mockApply).toHaveBeenCalledWith('Reset viewing-distance measurements', undefined);
  });

  test('defaults missing measurements in a legacy replay state', async () => {
    mockAnswers.value = {
      card: {
        componentName: '$virtual-chinrest.components.card-size',
        trialOrder: '1',
        answer: { pixelsPerMM: 5 },
      },
    };
    const { getByTestId, getByText } = render(
      <ViewingDistanceCalibration
        store={{}} registerGlobalStoreUpdater={() => () => undefined} parameters={{ blindspotAngle: 13.5 }}
        answers={{}}
        provenanceState={{ ballPosition: 500 } as never}
        setAnswer={vi.fn()}
        useTrrack={useTrrack}
      />,
    );

    await waitFor(() => expect(getByText(/Remaining measurements:/).textContent).toContain('5'));
    expect(getByTestId('blindspot-ball').style.left).toBe('500px');
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
