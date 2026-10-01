import { render, waitFor } from '@testing-library/react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import App from '../Upset';

const {
  mockGraph, mockInitializeProvenanceTracking, mockIsAnalysis, mockProcess,
} = vi.hoisted(() => ({
  mockGraph: { root: 'root', current: 'root', nodes: {} },
  mockInitializeProvenanceTracking: vi.fn(),
  mockIsAnalysis: { value: false },
  mockProcess: vi.fn(() => ({ processed: true })),
}));

vi.mock('@visdesignlab/upset2-react', () => ({
  Upset: () => <div data-testid="upset" />,
  getActions: vi.fn(() => ({})),
  initializeProvenanceTracking: mockInitializeProvenanceTracking,
  process: mockProcess,
}));

vi.mock('@visdesignlab/upset2-core', () => ({
  populateConfigDefaults: vi.fn(() => ({ initial: true })),
}));

vi.mock('../../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis.value,
}));

describe('demo UpSet replay integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAnalysis.value = false;
    mockInitializeProvenanceTracking.mockImplementation((state) => ({
      state,
      currentChange: vi.fn(() => vi.fn()),
      graph: { backend: mockGraph },
    }));
  });

  test('publishes the existing UpSet provenance graph through reVISit', async () => {
    const setAnswer = vi.fn();
    render(
      <App
        parameters={{}}
        answers={{}}
        provenanceState={undefined}
        setAnswer={setAnswer}
        useTrrack={vi.fn() as never}
      />,
    );

    await waitFor(() => expect(setAnswer).toHaveBeenCalledWith({
      status: true,
      answers: {},
      provenanceGraph: mockGraph,
    }));
    expect(mockProcess).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          _key: 'movies/40722782',
          _id: 'movies/40722782',
          _rev: '',
        }),
      ]),
      expect.objectContaining({
        _key: 'label',
        id: 'label',
        _rev: 'label',
        Name: 'label',
        ReleaseDate: 'number',
        Action: 'boolean',
      }),
    );
  });

  test('rehydrates replay state without accepting input or emitting provenance in analysis', () => {
    mockIsAnalysis.value = true;
    const replayState = { visibleSets: ['Action'] };
    const setAnswer = vi.fn();
    const { container } = render(
      <App
        parameters={{}}
        answers={{}}
        provenanceState={replayState as never}
        setAnswer={setAnswer}
        useTrrack={vi.fn() as never}
      />,
    );

    expect(mockInitializeProvenanceTracking).toHaveBeenCalledWith(replayState);
    expect(container.firstElementChild?.hasAttribute('inert')).toBe(true);
    expect(setAnswer).not.toHaveBeenCalled();
  });
});
