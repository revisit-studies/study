import {
  describe, expect, test, vi,
} from 'vitest';
import EventEmitter from './EventEmitter';

type Events = { data: [string]; count: [number] };

describe('EventEmitter', () => {
  test('on / emit: calls registered listeners with the emitted arguments', () => {
    const emitter = new EventEmitter<Events>();
    const received: string[] = [];
    emitter.on('data', (v) => received.push(v));
    emitter.emit('data', 'hello');
    expect(received).toEqual(['hello']);
  });

  test('emit: calls all registered listeners for an event', () => {
    const emitter = new EventEmitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    emitter.on('data', a);
    emitter.on('data', b);
    emitter.emit('data', 'x');
    expect(a).toHaveBeenCalledWith('x');
    expect(b).toHaveBeenCalledWith('x');
  });

  test('emit: does nothing when no listeners are registered for the event', () => {
    const emitter = new EventEmitter<Events>();
    expect(() => emitter.emit('data', 'x')).not.toThrow();
  });

  test('off with listener: removes only the specified listener', () => {
    const emitter = new EventEmitter<Events>();
    const keep = vi.fn();
    const remove = vi.fn();
    emitter.on('data', keep);
    emitter.on('data', remove);
    emitter.off('data', remove);
    emitter.emit('data', 'x');
    expect(keep).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  test('off without listener: removes all listeners for the event', () => {
    const emitter = new EventEmitter<Events>();
    const listener = vi.fn();
    emitter.on('data', listener);
    emitter.off('data');
    emitter.emit('data', 'x');
    expect(listener).not.toHaveBeenCalled();
  });

  test('off on an event with no listeners: does nothing', () => {
    const emitter = new EventEmitter<Events>();
    expect(() => emitter.off('data', vi.fn())).not.toThrow();
    expect(() => emitter.off('data')).not.toThrow();
  });

  test('multiple event types are independent', () => {
    const emitter = new EventEmitter<Events>();
    const dataListener = vi.fn();
    const countListener = vi.fn();
    emitter.on('data', dataListener);
    emitter.on('count', countListener);
    emitter.emit('count', 42);
    expect(dataListener).not.toHaveBeenCalled();
    expect(countListener).toHaveBeenCalledWith(42);
  });
});
