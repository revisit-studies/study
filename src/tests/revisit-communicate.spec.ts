import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test, vi } from 'vitest';

type MessageHandler = (event: unknown) => void;

test('registering an updater waits for explicit asynchronous initialization before restoring', async () => {
  const handlers = new Map<string, MessageHandler>();
  const parent = { postMessage: vi.fn() };
  const frame = {
    location: { search: '?id=frame' },
    parent,
    addEventListener: (type: string, handler: MessageHandler) => handlers.set(type, handler),
    Revisit: undefined as unknown as {
      beginRegistration: () => void;
      onRestore: (fn: () => void) => void;
      registerGlobalStoreUpdater: (fn: () => object) => void;
      completeRegistration: () => void;
    },
  };
  runInNewContext(readFileSync('public/revisitUtilities/revisit-communicate.js', 'utf8'), { window: frame, URLSearchParams, crypto });
  let ready = false;
  const restore = vi.fn(() => { expect(ready).toBe(true); });
  frame.Revisit.beginRegistration();
  frame.Revisit.onRestore(restore);
  const { documentId } = parent.postMessage.mock.calls.find(([data]) => data.type === '@REVISIT_COMMS/WINDOW_READY')![0].message;
  handlers.get('message')!({
    source: parent,
    data: {
      type: '@REVISIT_COMMS/RESUME',
      iframeId: 'frame',
      message: {
        documentId, requestId: 'resume', protocolVersion: 1, answers: { cost: 10 },
      },
    },
  });
  frame.Revisit.registerGlobalStoreUpdater(() => ({}));
  await Promise.resolve();
  expect(restore).not.toHaveBeenCalled();
  expect(parent.postMessage.mock.calls.some(([data]) => data.type === '@REVISIT_COMMS/RESTORED')).toBe(false);
  ready = true;
  frame.Revisit.completeRegistration();
  await Promise.resolve();
  expect(restore).toHaveBeenCalledTimes(1);
  expect(parent.postMessage.mock.calls.some(([data]) => data.type === '@REVISIT_COMMS/RESTORED')).toBe(true);
});

test('delivers only received store snapshots, including to late subscribers, and cleans up listeners', () => {
  const handlers = new Map<string, MessageHandler>();
  const parent = { postMessage: vi.fn() };
  const frame = {
    location: { search: '?id=frame' },
    parent,
    addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
    Revisit: undefined as unknown as { onGlobalVariablesReceive: (fn: (store: { budget: number }) => void) => () => void },
  };
  runInNewContext(readFileSync('public/revisitUtilities/revisit-communicate.js', 'utf8'), {
    window: frame, URLSearchParams, crypto,
  });
  const early = vi.fn();
  frame.Revisit.onGlobalVariablesReceive(early);
  expect(early).not.toHaveBeenCalled();

  const deliver = (budget: number) => handlers.get('message')!({
    source: parent,
    data: { type: '@REVISIT_COMMS/GLOBAL_STORE', iframeId: 'frame', message: { budget } },
  });
  deliver(70);
  expect(early).toHaveBeenCalledExactlyOnceWith({ budget: 70 });
  expect(Object.isFrozen(early.mock.calls[0][0])).toBe(true);

  const late = vi.fn();
  const unsubscribe = frame.Revisit.onGlobalVariablesReceive(late);
  expect(late).toHaveBeenCalledExactlyOnceWith({ budget: 70 });
  unsubscribe();
  deliver(50);
  expect(late).toHaveBeenCalledTimes(1);
});

test.each([undefined, 20])('a cached-page return keeps restored state and answers with draft %s', async (draftCost) => {
  const handlers = new Map<string, MessageHandler>();
  const parent = { postMessage: vi.fn() };
  const frame = {
    location: { search: '?id=frame' },
    parent,
    addEventListener: (type: string, handler: MessageHandler) => handlers.set(type, handler),
    Revisit: undefined as unknown as {
      registerGlobalStoreUpdater: (fn: () => object) => () => void;
      onRestore: (fn: () => void) => void;
      completeRegistration: () => void;
      postAnswers: (answers: object) => void;
    },
  };
  runInNewContext(readFileSync('public/revisitUtilities/revisit-communicate.js', 'utf8'), { window: frame, URLSearchParams, crypto });
  frame.Revisit.postAnswers({ selectedCost: 0 });
  frame.Revisit.registerGlobalStoreUpdater(() => ({}));
  const restore = vi.fn();
  frame.Revisit.onRestore(restore);
  frame.Revisit.completeRegistration();
  const { documentId } = parent.postMessage.mock.calls.find(([data]) => data.type === '@REVISIT_COMMS/WINDOW_READY')![0].message;
  const resume = () => handlers.get('message')!({
    source: parent,
    data: {
      type: '@REVISIT_COMMS/RESUME',
      iframeId: 'frame',
      message: {
        documentId, requestId: 'resume', protocolVersion: 1, answers: { selectedCost: 10 },
      },
    },
  });
  resume();
  await Promise.resolve();
  expect(restore).toHaveBeenCalledTimes(1);
  if (draftCost !== undefined) frame.Revisit.postAnswers({ selectedCost: draftCost });
  parent.postMessage.mockClear();
  handlers.get('pagehide')!({ persisted: true });
  expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({
    type: '@REVISIT_COMMS/GLOBAL_STORE_UPDATER', message: expect.objectContaining({ enabled: false }),
  }), '*');
  parent.postMessage.mockClear();
  handlers.get('pageshow')?.({ persisted: true });
  expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({
    type: '@REVISIT_COMMS/WINDOW_READY', message: expect.objectContaining({ globalStoreUpdater: true }),
  }), '*');
  parent.postMessage.mockClear();
  resume();
  await Promise.resolve();
  expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: '@REVISIT_COMMS/RESTORED' }), '*');
  expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: '@REVISIT_COMMS/ANSWERS', message: { selectedCost: draftCost ?? 10 } }), '*');
  expect(restore).toHaveBeenCalledTimes(1);
});
