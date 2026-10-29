import { useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import {
  afterEach, expect, test, vi,
} from 'vitest';
import { StartupInteractionProvider } from '../StartupContext';

function GlobalInput({ onInput }: { onInput: () => void }) {
  useEffect(() => {
    window.addEventListener('keydown', onInput, true);
    window.addEventListener('click', onInput, true);
    return () => {
      window.removeEventListener('keydown', onInput, true);
      window.removeEventListener('click', onInput, true);
    };
  }, [onInput]);
  return null;
}

afterEach(cleanup);

test('blocks global stimulus input through startup and reselection, then removes the barrier on unmount', () => {
  const onInput = vi.fn();
  const { rerender, unmount } = render(
    <StartupInteractionProvider value><GlobalInput onInput={onInput} /></StartupInteractionProvider>,
  );
  const dispatchInput = () => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    window.dispatchEvent(new MouseEvent('click', { cancelable: true }));
  });
  dispatchInput();
  expect(onInput).not.toHaveBeenCalled();
  rerender(<StartupInteractionProvider value={false}><GlobalInput onInput={onInput} /></StartupInteractionProvider>);
  dispatchInput();
  expect(onInput).toHaveBeenCalledTimes(2);
  rerender(<StartupInteractionProvider value><GlobalInput onInput={onInput} /></StartupInteractionProvider>);
  dispatchInput();
  expect(onInput).toHaveBeenCalledTimes(2);
  unmount();
  expect(window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }))).toBe(true);
});
