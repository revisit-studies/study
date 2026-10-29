import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { initializeTrrack, Registry } from '@trrack/core';
import { expect, test, vi } from 'vitest';

const source = readFileSync('public/revisitUtilities/revisit-communicate.js', 'utf8');
function setup(query = '?id=frame', uuidAvailable = true) {
  const parent = { postMessage: vi.fn() };
  const listeners = new Map<string, (event: unknown) => void>();
  const window = {
    parent, location: { search: query },
    addEventListener: (type: string, handler: (event: unknown) => void) => listeners.set(type, handler),
  };
  const context = { window, URLSearchParams, structuredClone, crypto: { randomUUID: uuidAvailable ? () => 'document' : undefined }, document: { readyState: 'complete' }, Date, console };
  runInNewContext(source, context);
  const api = (window as unknown as { Revisit: {
    createTrrack: (options: Record<string, unknown>) => ReturnType<typeof initializeTrrack>;
    onRestore: (callback: (state: { answers: Record<string, unknown>; provenanceGraph?: unknown }) => unknown) => void;
    beginRegistration: () => void;
    completeRegistration: () => void;
    postAnswers: (answers: Record<string, unknown>) => void;
    onDataReceive: (callback: (data: unknown) => void) => void;
    onProvenanceReceive: (callback: (data: unknown) => void) => void;
    onAnswersReceive: (callback: (data: unknown) => void) => void;
  } }).Revisit;
  return {
    api, parent,
    send: (tag: string, message: unknown, sender = parent) => listeners.get('message')?.({ source: sender, data: { iframeId: 'frame', type: `@REVISIT_COMMS/${tag}`, message } }),
    load: () => listeners.get('load')?.({}),
    messages: (tag: string) => parent.postMessage.mock.calls.map(([data]) => data).filter((data) => data.type === `@REVISIT_COMMS/${tag}`),
  };
}
const resume = { protocolVersion: 1, documentId: 'document', requestId: 'request', isAnalysis: false, answers: { count: 2 } };

test('buffers initialization, imports full history and renders before acknowledging and publishing', async () => {
  const helper = setup();
  const registry = Registry.create();
  const add = registry.register('add', (state: { count: number }, _payload: number) => { state.count += 1; return state; });
  const original = initializeTrrack({ registry, initialState: { count: 1 } });
  await original.apply('First visit', add(1));
  const saved = structuredClone(original.graph.backend);
  const trrack = helper.api.createTrrack({ initializeTrrack, registry, initialState: { count: 0 } });
  helper.api.postAnswers({ count: 0 });
  expect(helper.messages('PROVENANCE')).toHaveLength(0);
  helper.send('RESUME', { ...resume, provenanceGraph: saved });
  expect(trrack.getState()).toEqual({ count: 0 });
  helper.api.onRestore(() => { helper.api.postAnswers(trrack.getState()); });
  helper.api.completeRegistration();
  await vi.waitFor(() => expect(helper.messages('RESTORED')).toHaveLength(1));
  expect(trrack.graph.backend).toEqual(saved);
  expect(helper.messages('ANSWERS').at(-1)?.message).toEqual({ count: 2 });
  expect(helper.messages('PROVENANCE')).toHaveLength(0);
  await trrack.apply('Second visit', add(1));
  expect(helper.messages('PROVENANCE').at(-1)?.message.root).toBe(saved.root);
  expect(trrack.getState()).toEqual({ count: 3 });
});

test('silent legacy helpers remain unknown; explicit completion reports unsupported', async () => {
  const helper = setup();
  helper.load();
  expect(helper.messages('WINDOW_READY')[0].message.protocolVersion).toBe(0);
  expect(helper.messages('RESTORATION_CAPABILITY')).toHaveLength(0);
  helper.send('RESUME', resume);
  helper.api.completeRegistration();
  await vi.waitFor(() => expect(helper.messages('RESTORATION_CAPABILITY')).toHaveLength(1));
  expect(helper.messages('RESTORATION_CAPABILITY')[0].message.supported).toBe(false);
  expect(helper.messages('RESTORED')).toHaveLength(0);
});

test('failed asynchronous restoration offers retry without publishing temporary answers', async () => {
  const helper = setup();
  const callback = vi.fn().mockRejectedValueOnce(new Error('Editor failed')).mockImplementation(() => helper.api.postAnswers({ count: 2 }));
  helper.api.onRestore(callback);
  helper.api.completeRegistration();
  helper.send('RESUME', resume);
  await vi.waitFor(() => expect(helper.messages('RESTORATION_ERROR')).toHaveLength(1));
  expect(helper.messages('ANSWERS')).toHaveLength(0);
  helper.send('RETRY_RESTORE', { requestId: 'request' });
  await vi.waitFor(() => expect(helper.messages('RESTORED')).toHaveLength(1));
  expect(helper.messages('ANSWERS').at(-1)?.message).toEqual({ count: 2 });
});

test('analysis never imports editable history or publishes participant data', async () => {
  const helper = setup();
  const callback = vi.fn();
  helper.api.onRestore(callback);
  helper.api.completeRegistration();
  helper.send('RESUME', { ...resume, isAnalysis: true });
  await vi.waitFor(() => expect(helper.messages('RESTORED')).toHaveLength(1));
  expect(callback).not.toHaveBeenCalled();
  helper.api.postAnswers({ count: 5 });
  expect(helper.messages('ANSWERS')).toHaveLength(0);
});

test('ignores messages from other windows and previous documents', () => {
  const helper = setup();
  helper.api.onRestore(vi.fn());
  helper.api.completeRegistration();
  helper.send('RESUME', resume, { postMessage: vi.fn() });
  helper.send('RESUME', { ...resume, documentId: 'stale' });
  expect(helper.messages('RESTORED')).toHaveLength(0);
});


test('late legacy registration cannot claim that importing the graph alone restores its interface', async () => {
  const helper = setup();
  helper.api.createTrrack({ initializeTrrack, registry: Registry.create(), initialState: {} });
  helper.load();
  expect(helper.messages('PROVENANCE')).toHaveLength(1);
  helper.api.completeRegistration();
  helper.send('RESUME', resume);
  await vi.waitFor(() => expect(helper.messages('RESTORATION_CAPABILITY')).toHaveLength(1));
  expect(helper.messages('RESTORATION_CAPABILITY')[0].message.supported).toBe(false);
});

test('external websites receive their iframe identifier through the handshake', async () => {
  const helper = setup('?id=website-owned-id');
  helper.api.onRestore(() => helper.api.postAnswers({ count: 2 }));
  helper.api.completeRegistration();
  helper.send('RESUME', resume);
  await vi.waitFor(() => expect(helper.messages('RESTORED')).toHaveLength(1));
  expect(helper.messages('RESTORED')[0].iframeId).toBe('frame');
});


test('holds answer-only defaults across load until late registration and asynchronous restoration finish', async () => {
  const helper = setup();
  helper.api.beginRegistration();
  helper.load();
  helper.api.postAnswers({ count: 0 });
  expect(helper.messages('ANSWERS')).toHaveLength(0);
  helper.send('RESUME', resume);
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => { finish = resolve; });
  helper.api.onRestore(async ({ answers }) => {
    await ready;
    helper.api.postAnswers(answers);
  });
  helper.api.completeRegistration();
  expect(helper.messages('ANSWERS')).toHaveLength(0);
  expect(helper.messages('RESTORED')).toHaveLength(0);
  finish();
  await vi.waitFor(() => expect(helper.messages('RESTORED')).toHaveLength(1));
  expect(helper.messages('ANSWERS').map((data) => data.message)).toEqual([{ count: 2 }]);
  helper.api.postAnswers({ count: 3 });
  expect(helper.messages('ANSWERS').at(-1)?.message).toEqual({ count: 3 });
});


test('pages without early registration retain legacy answer publications', () => {
  const helper = setup();
  helper.api.postAnswers({ count: 0 });
  helper.load();
  helper.api.postAnswers({ count: 1 });
  expect(helper.messages('ANSWERS').map((data) => data.message)).toEqual([{ count: 0 }, { count: 1 }]);
  expect(helper.messages('RESTORATION_CAPABILITY')).toHaveLength(0);
});


test.each([
  ['STUDY_DATA', 'onDataReceive'],
  ['PROVENANCE', 'onProvenanceReceive'],
  ['ANSWERS', 'onAnswersReceive'],
] as const)('delivers the latest %s snapshot to its late handler', (tag, register) => {
  const helper = setup();
  helper.api.beginRegistration();
  helper.send(tag, { taskId: 'old-task' });
  helper.send(tag, { taskId: 'configured-task' });
  const receive = vi.fn();
  helper.api[register](receive);
  expect(receive.mock.calls).toEqual([[{ taskId: 'configured-task' }]]);
  helper.send(tag, { taskId: 'next-task' });
  expect(receive.mock.calls).toEqual([[{ taskId: 'configured-task' }], [{ taskId: 'next-task' }]]);
});


test('delivering a late replay snapshot cannot publish participant data', async () => {
  const helper = setup();
  helper.api.beginRegistration();
  helper.send('RESUME', { ...resume, isAnalysis: true });
  helper.send('PROVENANCE', { count: 3 });
  const receive = vi.fn(() => helper.api.postAnswers({ count: 3 }));
  helper.api.onRestore(vi.fn());
  helper.api.completeRegistration();
  helper.api.onProvenanceReceive(receive);
  await vi.waitFor(() => expect(helper.messages('RESTORED')).toHaveLength(1));
  expect(receive).toHaveBeenCalledWith({ count: 3 });
  expect(helper.messages('ANSWERS')).toHaveLength(0);
  expect(helper.messages('PROVENANCE')).toHaveLength(0);
});


test('completes the website handshake when randomUUID is unavailable', async () => {
  const helper = setup('?id=frame', false);
  helper.api.onRestore(vi.fn());
  helper.api.completeRegistration();
  const documentId = helper.messages('WINDOW_READY')[0].message.documentId;
  expect(typeof documentId).toBe('string');
  expect(documentId.length).toBeGreaterThan(0);
  helper.send('RESUME', { ...resume, documentId });
  await vi.waitFor(() => expect(helper.messages('RESTORED')).toHaveLength(1));
});
