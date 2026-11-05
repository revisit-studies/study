import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import Ajv from 'ajv';
import { expect, test, vi } from 'vitest';
import schema from '../../src/parser/StudyConfigSchema.json';

type MessageHandler = (event: unknown) => void;

const documentation = readFileSync('typedocDocuments/Revisit.postAnswers.md', 'utf8');

test('the documented website component satisfies the study schema', () => {
  const snippet = documentation.match(/```json\n([\s\S]*?)\n```/)?.[1];
  expect(snippet).toBeDefined();
  const validate = new Ajv({ strict: false }).compile({ ...schema, $ref: '#/definitions/WebsiteComponent' });
  expect(validate(JSON.parse(snippet!)), JSON.stringify(validate.errors)).toBe(true);
});

test('the documented HTML restores answers and publishes later edits', async () => {
  const snippet = documentation.match(/```html\n[\s\S]*?<script>([\s\S]*?)<\/script>/)?.[1];
  expect(snippet).toBeDefined();
  const windowHandlers = new Map<string, MessageHandler>();
  const inputHandlers = new Map<string, VoidFunction>();
  const input = {
    value: '',
    addEventListener: (event: string, handler: () => void) => inputHandlers.set(event, handler),
  };
  const parent = { postMessage: vi.fn() };
  const frame = {
    location: { search: '?id=example' },
    parent,
    addEventListener: (event: string, handler: (value: unknown) => void) => windowHandlers.set(event, handler),
    Revisit: {},
  };
  const context = {
    window: frame, URLSearchParams, crypto: { randomUUID: () => 'example-document' }, document: { getElementById: () => input },
  };
  runInNewContext(readFileSync('public/revisitUtilities/revisit-communicate.js', 'utf8'), context);
  runInNewContext(snippet!, { ...context, Revisit: frame.Revisit });
  windowHandlers.get('message')!({
    source: parent,
    data: {
      iframeId: 'example',
      type: '@REVISIT_COMMS/RESUME',
      message: {
        protocolVersion: 1, documentId: 'example-document', requestId: 'restore-example', answers: { selection: 'A' }, isAnalysis: false,
      },
    },
  });
  await vi.waitFor(() => expect(input.value).toBe('A'));
  input.value = 'B';
  inputHandlers.get('input')!();
  await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({
    type: '@REVISIT_COMMS/ANSWERS', message: { selection: 'B' },
  }), '*'));
});
