// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { act } from 'react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { useGamepad, type GamepadDevice, type UseGamepadOptions } from '../useGamepad';

function makeGamepad({
  index = 0,
  pressed = [] as boolean[],
  axes = [] as number[],
  id = 'Xbox Wireless Controller (STANDARD GAMEPAD)',
  mapping = 'standard',
}): Gamepad {
  return {
    id,
    index,
    mapping,
    connected: true,
    timestamp: 0,
    axes,
    buttons: pressed.map((isPressed) => ({
      pressed: isPressed,
      touched: isPressed,
      value: isPressed ? 1 : 0,
    })),
  } as unknown as Gamepad;
}

let frameCallbacks: FrameRequestCallback[] = [];
let pads: (Gamepad | null)[] = [];

/** Runs every frame callback queued since the last step. */
function step(times = 1) {
  for (let i = 0; i < times; i += 1) {
    const queued = frameCallbacks;
    frameCallbacks = [];
    act(() => {
      queued.forEach((callback) => callback(performance.now()));
    });
  }
}

function Harness(props: UseGamepadOptions) {
  useGamepad(props);
  return null;
}

describe('useGamepad', () => {
  beforeEach(() => {
    frameCallbacks = [];
    pads = [];

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    Object.defineProperty(navigator, 'getGamepads', {
      value: () => pads,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('reports a connection once the first gamepad appears', () => {
    const onConnectionChange = vi.fn();
    render(<Harness onConnectionChange={onConnectionChange} />);

    step();
    expect(onConnectionChange).not.toHaveBeenCalled();

    pads = [makeGamepad({ pressed: [false, false, false, false] })];
    step();

    expect(onConnectionChange).toHaveBeenCalledTimes(1);
    const device = onConnectionChange.mock.calls[0][0] as GamepadDevice;
    expect(device.mapping).toBe('standard');
    expect(device.id).toContain('Xbox');

    // A gamepad that stays connected must not be re-announced every frame.
    step(3);
    expect(onConnectionChange).toHaveBeenCalledTimes(1);
  });

  test('emits one button down per press and one up per release', () => {
    const onButtonDown = vi.fn();
    const onButtonUp = vi.fn();
    render(<Harness onButtonDown={onButtonDown} onButtonUp={onButtonUp} />);

    pads = [makeGamepad({ pressed: [false, false, false, false] })];
    step();

    pads = [makeGamepad({ pressed: [true, false, false, false] })];
    step();
    expect(onButtonDown).toHaveBeenCalledTimes(1);
    expect(onButtonDown.mock.calls[0][0]).toBe('A');
    expect(onButtonDown.mock.calls[0][1]).toBe(0);

    // Holding the button must not re-fire while it stays down.
    step(4);
    expect(onButtonDown).toHaveBeenCalledTimes(1);
    expect(onButtonUp).not.toHaveBeenCalled();

    pads = [makeGamepad({ pressed: [false, false, false, false] })];
    step();
    expect(onButtonUp).toHaveBeenCalledTimes(1);
    expect(onButtonUp.mock.calls[0][0]).toBe('A');
  });

  test('names face buttons by their standard-mapping position', () => {
    const onButtonDown = vi.fn();
    render(<Harness onButtonDown={onButtonDown} />);

    pads = [makeGamepad({ pressed: [false, false, false, false] })];
    step();

    pads = [makeGamepad({ pressed: [false, true, false, true] })];
    step();

    expect(onButtonDown.mock.calls.map((call) => call[0])).toEqual(['B', 'Y']);
  });

  test('applies the deadzone and only reports axes that actually moved', () => {
    const onAxes = vi.fn();
    render(<Harness onAxes={onAxes} deadzone={0.2} axisEpsilon={0.05} />);

    // First sight of the gamepad records a baseline; the stick rests inside the
    // deadzone, so it reads as exactly zero rather than as raw jitter.
    pads = [makeGamepad({ pressed: [], axes: [0.1, -0.05] })];
    step();
    expect(onAxes).toHaveBeenCalledTimes(1);
    expect(onAxes.mock.calls[0][0]).toEqual([0, 0]);

    // Resting there reports nothing further.
    step(3);
    expect(onAxes).toHaveBeenCalledTimes(1);

    pads = [makeGamepad({ pressed: [], axes: [1, 0] })];
    step();
    expect(onAxes).toHaveBeenCalledTimes(2);
    expect(onAxes.mock.calls[1][0][0]).toBeCloseTo(1, 5);

    // A jitter smaller than axisEpsilon is not worth an event.
    pads = [makeGamepad({ pressed: [], axes: [0.99, 0] })];
    step();
    expect(onAxes).toHaveBeenCalledTimes(2);
  });

  test('reports a disconnection when the gamepad goes away', () => {
    const onConnectionChange = vi.fn();
    render(<Harness onConnectionChange={onConnectionChange} />);

    pads = [makeGamepad({ pressed: [false] })];
    step();
    expect(onConnectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ mapping: 'standard' }), expect.any(Number));

    pads = [];
    step();
    expect(onConnectionChange).toHaveBeenLastCalledWith(null, expect.any(Number));

    // Staying disconnected must not keep firing.
    step(3);
    expect(onConnectionChange).toHaveBeenCalledTimes(2);
  });

  test('onFrame fires every frame so held sticks can drive continuous motion', () => {
    const onFrame = vi.fn();
    render(<Harness onFrame={onFrame} />);

    pads = [makeGamepad({ pressed: [false], axes: [1, 0] })];
    step(3);

    expect(onFrame).toHaveBeenCalledTimes(3);
    expect(onFrame.mock.calls[0][0].axes[0]).toBeCloseTo(1, 5);
    expect(typeof onFrame.mock.calls[0][1]).toBe('number');
  });

  test('does not poll when disabled', () => {
    const onFrame = vi.fn();
    render(<Harness onFrame={onFrame} enabled={false} />);

    pads = [makeGamepad({ pressed: [true] })];
    step(3);

    expect(onFrame).not.toHaveBeenCalled();
  });
});
