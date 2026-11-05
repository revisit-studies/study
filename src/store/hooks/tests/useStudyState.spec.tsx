import {
  act, cleanup, fireEvent, render, screen,
} from '@testing-library/react';
import { initializeTrrack, Registry } from '@trrack/core';
import {
  afterEach, expect, test, vi,
} from 'vitest';
import { StudyStateContext, useStudyState, useStatelessStudyComponent } from '../useStudyState';

afterEach(cleanup);

test('renders the imported current state and tracks subsequent edits without an initialization event', async () => {
  const registry = Registry.create();
  const change = registry.register('change', (state: { text: string }, text: string) => { state.text = text; return state; });
  const trrack = initializeTrrack({ registry, initialState: { text: 'earlier answer' } });
  const register = vi.fn(() => vi.fn());
  const onRestore = vi.fn();
  function Stimulus() {
    const state = useStudyState({ trrack, onRestore });
    return <button type="button" onClick={() => trrack.apply('Edit', change('later answer'))}>{state.text}</button>;
  }
  render(<StudyStateContext.Provider value={{ register, answers: {} }}><Stimulus /></StudyStateContext.Provider>);
  expect(screen.getByRole('button').textContent).toBe('earlier answer');
  expect(register).toHaveBeenCalledWith('state');
  expect(onRestore).toHaveBeenCalledWith({ text: 'earlier answer' });
  expect(Object.keys(trrack.graph.backend.nodes)).toHaveLength(1);
  await act(async () => { fireEvent.click(screen.getByRole('button')); });
  expect(screen.getByRole('button').textContent).toBe('later answer');
});

test('answer-only restoration preserves empty saved values and cleans up registration and editor callbacks', () => {
  const unregister = vi.fn();
  const dispose = vi.fn();
  const onRestore = vi.fn(() => dispose);
  const register = vi.fn(() => unregister);
  function Stimulus() {
    const [text, setText] = useStudyState({ responseId: 'answer', initialState: 'default', onRestore });
    return <input aria-label="Answer" value={text} onChange={(event) => setText(event.target.value)} />;
  }
  const view = render(<StudyStateContext.Provider value={{ register, answers: { answer: '' } }}><Stimulus /></StudyStateContext.Provider>);
  expect((screen.getByLabelText('Answer') as HTMLInputElement).value).toBe('');
  expect(onRestore).toHaveBeenCalledWith('');
  fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'edit' } });
  expect((screen.getByLabelText('Answer') as HTMLInputElement).value).toBe('edit');
  expect(onRestore).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(unregister).toHaveBeenCalledTimes(1);
  expect(dispose).toHaveBeenCalledTimes(1);
});

test('stateless components register explicitly', () => {
  const register = vi.fn(() => vi.fn());
  function Stateless() { useStatelessStudyComponent(); return null; }
  render(<StudyStateContext.Provider value={{ register, answers: {} }}><Stateless /></StudyStateContext.Provider>);
  expect(register).toHaveBeenCalledWith('stateless');
});
