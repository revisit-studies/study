// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener<T extends any[] = any[]> = (...args: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class EventEmitter<Events extends Record<string, any[]>> {
  private listeners: {
    [K in keyof Events]?: Listener<Events[K]>[];
  } = {};

  /**
   * Subscribes a listener function to a specific event.
   */
  on<K extends keyof Events>(eventName: K, listener: Listener<Events[K]>): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]!.push(listener);
  }

  /**
   * Unsubscribes a specific listener function from an event.
   * If no listener is provided, all listeners for that event are removed.
   */
  off<K extends keyof Events>(eventName: K, listener?: Listener<Events[K]>): void {
    if (!this.listeners[eventName]) return;

    if (listener) {
      this.listeners[eventName] = this.listeners[eventName]!.filter(
        (l) => l !== listener,
      );
    } else {
      delete this.listeners[eventName];
    }
  }

  /**
   * Emits an event with given arguments.
   */
  emit<K extends keyof Events>(eventName: K, ...args: Events[K]): void {
    if (!this.listeners[eventName]) return;

    const currentListeners = [...this.listeners[eventName]!];
    currentListeners.forEach((listener) => listener(...args));
  }
}

export default EventEmitter;
