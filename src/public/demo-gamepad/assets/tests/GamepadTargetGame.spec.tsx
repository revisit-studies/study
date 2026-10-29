import { MantineProvider } from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import { act, render, cleanup } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import GamepadTargetGame from '../GamepadTargetGame';
import { RevisitProvenanceProvider } from '../../../../store/hooks/useRevisitTrrack';
import { StudyStateContext } from '../../../../store/hooks/useStudyState';
import type { UseGamepadOptions } from '../../../../store/hooks/useGamepad';

const mocks = vi.hoisted(() => ({ onButtonDown: undefined as UseGamepadOptions['onButtonDown'] }));
vi.mock('../../../../store/hooks/useGamepad', () => ({
  useGamepad: (options: UseGamepadOptions) => {
    mocks.onButtonDown = options.onButtonDown;
    return { connected: true };
  },
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('restored and subsequent targets measure their presentation without changing history', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const saved = initializeTrrack({
    registry: Registry.create(),
    initialState: {
      round: 0,
      target: { index: 0, x: 320, y: 210, button: 'A', spawnedAt: 1000 },
      reticle: { x: 320, y: 210 },
      hits: 0,
      misses: 0,
      outcome: 'Target 1',
      completed: false,
    },
  }).graph.backend;
  const history = JSON.stringify(saved);
  vi.setSystemTime(61000);
  const setAnswer = vi.fn();
  render(
    <MantineProvider>
      <RevisitProvenanceProvider provenance={saved} onProvenanceChange={vi.fn()}>
        {(useTrrack) => <GamepadTargetGame parameters={{ targetCount: 2 }} answers={{}} setAnswer={setAnswer} useTrrack={useTrrack} />}
      </RevisitProvenanceProvider>
    </MantineProvider>,
  );
  await act(async () => {
    vi.setSystemTime(61100);
    mocks.onButtonDown?.('A', 0, Date.now());
  });
  expect(setAnswer.mock.lastCall?.[0].answers).toMatchObject({ hits: 1, meanReactionTime: 100 });
  await act(async () => {
    vi.setSystemTime(61600);
    mocks.onButtonDown?.('X', 2, Date.now());
  });
  expect(setAnswer.mock.lastCall?.[0].answers).toMatchObject({ hits: 2, completed: true, meanReactionTime: 300 });
  expect(JSON.stringify(saved)).toBe(history);
});

test('answer-only restoration completes only the remaining targets', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const setAnswer = vi.fn();
  render(
    <MantineProvider>
      <StudyStateContext.Provider
        value={{ answers: { hits: 4, misses: 2, completed: false }, register: () => () => {} }}
      >
        <RevisitProvenanceProvider onProvenanceChange={vi.fn()}>
          {(useTrrack) => <GamepadTargetGame parameters={{ targetCount: 6 }} answers={{}} setAnswer={setAnswer} useTrrack={useTrrack} />}
        </RevisitProvenanceProvider>
      </StudyStateContext.Provider>
    </MantineProvider>,
  );
  await act(async () => mocks.onButtonDown?.('X', 2, Date.now()));
  expect(setAnswer.mock.lastCall?.[0].answers).toMatchObject({ hits: 5, misses: 2, completed: false });
  await act(async () => mocks.onButtonDown?.('X', 2, Date.now()));
  expect(setAnswer.mock.lastCall?.[0].answers).toMatchObject({ hits: 6, misses: 2, completed: true });
});
