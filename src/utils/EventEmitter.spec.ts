import {
  describe, expect, it, vi,
} from 'vitest';
import EventEmitter from './EventEmitter';

type TestEvents = {
  message: [string];
  pair: [number, number];
};

describe('EventEmitter', () => {
  it('subscribes and emits events to listeners', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('message', listener);
    emitter.emit('message', 'hello');

    expect(listener).toHaveBeenCalledWith('hello');
  });

  it('removes only the provided listener when off gets a callback', () => {
    const emitter = new EventEmitter<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();

    emitter.on('pair', a);
    emitter.on('pair', b);
    emitter.off('pair', a);
    emitter.emit('pair', 1, 2);

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(1, 2);
  });

  it('removes all listeners when off is called without a callback', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('message', listener);
    emitter.off('message');
    emitter.emit('message', 'ignored');

    expect(listener).not.toHaveBeenCalled();
  });
});
