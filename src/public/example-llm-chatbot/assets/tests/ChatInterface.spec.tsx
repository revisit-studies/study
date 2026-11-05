import { initializeTrrack, Registry } from '@trrack/core';
import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ChatInterface from '../ChatInterface';
import type { ChatMessage } from '../types';

vi.mock('../../../../routes/utils', () => ({ useStudyId: () => 'study' }));
beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    observe() {}

    unobserve() {}

    disconnect() {}
  });
  Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  vi.stubGlobal('visualViewport', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test.each([false, true])('restored conversation reaches the server before answering (tools: %s)', async (useTools) => {
  const messages: ChatMessage[] = [
    { role: 'user', content: 'My name is Ada', timestamp: 1000, display: true },
    { role: 'assistant', content: 'Hello Ada', timestamp: 2000, display: true },
  ];
  const registry = Registry.create();
  const updateMessages = registry.register('update-messages', (state: { messages: ChatMessage[] }, payload: ChatMessage[]) => {
    state.messages = payload;
    return state;
  });
  const trrack = initializeTrrack({ registry, initialState: { messages } });
  const fetch = vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'selection-id',
        output: useTools ? [{ type: 'function_call', name: 'get_chart_image_file_id', call_id: 'chart-call' }] : [],
      }),
    })
    .mockResolvedValue({ ok: false, status: 500, text: async () => 'stop after request capture' });
  vi.stubGlobal('fetch', fetch);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<MantineProvider><ChatInterface trrack={trrack} actions={{ updateMessages }} updateProvenanceState={vi.fn()} /></MantineProvider>);
  expect(screen.getByText('My name is Ada')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'What is my name?' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send message' })));
  const selection = JSON.parse(fetch.mock.calls[0][1].body);
  const stream = JSON.parse(fetch.mock.calls[1][1].body);
  const conversation = [
    { role: 'user', content: 'My name is Ada' },
    { role: 'assistant', content: 'Hello Ada' },
    { role: 'user', content: [{ type: 'input_text', text: 'What is my name?' }] },
  ];
  expect(selection.input).toEqual(conversation);
  expect(selection.previous_response_id).toBeUndefined();
  if (useTools) {
    expect(stream.previous_response_id).toBe('selection-id');
    expect(stream.input[0]).toMatchObject({ type: 'function_call_output', call_id: 'chart-call' });
  } else {
    expect(stream.input).toEqual(conversation);
    expect(stream.previous_response_id).toBeUndefined();
  }
});
