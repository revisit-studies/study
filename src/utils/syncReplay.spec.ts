import { describe, expect, test } from 'vitest';
import { revisitPageId, syncChannel, syncEmitter } from './syncReplay';

describe('syncReplay module', () => {
  test('revisitPageId is a non-empty string', () => {
    expect(typeof revisitPageId).toBe('string');
    expect(revisitPageId.length).toBeGreaterThan(0);
  });

  test('syncChannel is a BroadcastChannel', () => {
    expect(syncChannel).toBeInstanceOf(BroadcastChannel);
    expect(syncChannel.name).toBe(`sync-${revisitPageId}`);
  });

  test('syncEmitter re-emits events received from syncChannel', () => {
    const received: string[] = [];
    syncEmitter.on('testEvent', (value: string) => received.push(value));

    syncChannel.onmessage!(new MessageEvent('message', {
      data: { key: 'testEvent', value: 'hello' },
    }));

    expect(received).toEqual(['hello']);
    syncEmitter.off('testEvent', received.push.bind(received));
  });
});
