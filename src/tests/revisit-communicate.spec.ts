import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test, vi } from 'vitest';

type MessageHandler = (event: unknown) => void;

test('delivers only received store snapshots, including to late subscribers, and cleans up listeners', () => {
  const handlers = new Map<string, MessageHandler>();
  const parent = { postMessage: vi.fn() };
  const frame = {
    location: { search: '?id=frame' },
    parent,
    addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
    Revisit: undefined as unknown as { onGlobalStoreReceive: (fn: (store: { budget: number }) => void) => () => void },
  };
  runInNewContext(readFileSync('public/revisitUtilities/revisit-communicate.js', 'utf8'), {
    window: frame, URLSearchParams, crypto,
  });
  const early = vi.fn();
  frame.Revisit.onGlobalStoreReceive(early);
  expect(early).not.toHaveBeenCalled();

  const deliver = (budget: number) => handlers.get('message')!({
    source: parent,
    data: { type: '@REVISIT_COMMS/GLOBAL_STORE', iframeId: 'frame', message: { budget } },
  });
  deliver(70);
  expect(early).toHaveBeenCalledExactlyOnceWith({ budget: 70 });
  expect(Object.isFrozen(early.mock.calls[0][0])).toBe(true);

  const late = vi.fn();
  const unsubscribe = frame.Revisit.onGlobalStoreReceive(late);
  expect(late).toHaveBeenCalledExactlyOnceWith({ budget: 70 });
  unsubscribe();
  deliver(50);
  expect(late).toHaveBeenCalledTimes(1);
});
