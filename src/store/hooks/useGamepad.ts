import {
  useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import { getButtonName } from '../../utils/gamepadButtons';

/** Identifying information for the gamepad currently being polled. */
export interface GamepadDevice {
  /** Browser-reported device string, e.g. "Xbox Wireless Controller (STANDARD GAMEPAD)". */
  id: string;
  /** Slot in `navigator.getGamepads()`. */
  index: number;
  /** `"standard"` when the browser recognises the W3C button/axis layout, otherwise `""`. */
  mapping: string;
  buttonCount: number;
  axisCount: number;
}

/** Per-frame view of the active gamepad, handed to {@link UseGamepadOptions.onFrame}. */
export interface GamepadFrame {
  device: GamepadDevice;
  /** Axis values with the deadzone applied and rescaled to a full -1..1 range. */
  axes: number[];
  /** Whether each button is currently held. */
  pressed: boolean[];
  /** Analog value per button; triggers are continuous, face buttons are 0 or 1. */
  values: number[];
}

export interface UseGamepadOptions {
  /** Fires once per button press, with `Date.now()` for consistency with reVISit's other window events. */
  onButtonDown?: (button: string, index: number, timestamp: number) => void;
  /** Fires once per button release. */
  onButtonUp?: (button: string, index: number, timestamp: number) => void;
  /**
   * Fires when an axis moves further than `axisEpsilon`, so a stick held steady stays
   * silent. Also fires once when a gamepad is first seen, recording its resting
   * position -- a stick that rests away from zero is drifting, which is worth knowing
   * about in analysis.
   */
  onAxes?: (axes: number[], timestamp: number) => void;
  /** Fires when a gamepad appears or goes away. `null` means no gamepad is available. */
  onConnectionChange?: (device: GamepadDevice | null, timestamp: number) => void;
  /**
   * Fires every animation frame while a gamepad is connected. Use this for
   * continuous motion — a held stick reports the same axis value every frame,
   * so {@link onAxes} alone cannot drive a moving cursor.
   */
  onFrame?: (frame: GamepadFrame, deltaMs: number) => void;
  /** Axis magnitudes below this are treated as zero. Sticks rarely rest at exactly 0. */
  deadzone?: number;
  /** Minimum axis change before `onAxes` fires again. */
  axisEpsilon?: number;
  /** Set false to stop polling entirely. */
  enabled?: boolean;
}

function readGamepads(): (Gamepad | null)[] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return [];
  }
  try {
    return Array.from(navigator.getGamepads());
  } catch {
    // Safari throws rather than returning an empty list when access is unavailable.
    return [];
  }
}

/**
 * Rescales an axis so motion begins smoothly at the edge of the deadzone instead
 * of jumping to `deadzone` the moment the stick is nudged.
 */
function applyDeadzone(value: number, deadzone: number): number {
  const magnitude = Math.abs(value);
  if (magnitude < deadzone) {
    return 0;
  }
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone));
}

function toDevice(gamepad: Gamepad): GamepadDevice {
  return {
    id: gamepad.id,
    index: gamepad.index,
    mapping: gamepad.mapping,
    buttonCount: gamepad.buttons.length,
    axisCount: gamepad.axes.length,
  };
}

/**
 * Polls the Gamepad API and turns it into discrete events.
 *
 * Unlike mouse and keyboard, the Gamepad API delivers no input events at all:
 * `navigator.getGamepads()` returns a snapshot that has to be read on a timer and
 * diffed against the previous read. This hook runs that loop on
 * `requestAnimationFrame` and synthesises button down/up events from the diff.
 *
 * Two consequences are worth knowing about when interpreting the data:
 *
 * - **Timing is quantised to the display refresh.** Timestamps are when the poll
 *   observed the press, not when the button physically closed, so they carry up to
 *   one frame (~8-16ms) of error. That is fine for target selection, but it is a
 *   real limit for precision reaction-time work.
 * - **Nothing is reported until the participant presses a button.** Browsers hide
 *   gamepads from a page until it has received gamepad input, as an
 *   anti-fingerprinting measure, so studies need an explicit "press a button to
 *   connect" step. `onConnectionChange` fires when that happens.
 *
 * Polling also pauses while the tab is hidden, because `requestAnimationFrame`
 * does not run in background tabs.
 */
export function useGamepad(options: UseGamepadOptions = {}): {
  device: GamepadDevice | null;
  /** True once a gamepad has been seen, i.e. after the participant's first button press. */
  connected: boolean;
  } {
  const {
    deadzone = 0.15,
    axisEpsilon = 0.02,
    enabled = true,
  } = options;

  // Held in a ref so the polling loop always calls the latest handlers without
  // needing to be torn down and restarted on every render.
  const handlersRef = useRef(options);
  useLayoutEffect(() => {
    handlersRef.current = options;
  });

  const [device, setDevice] = useState<GamepadDevice | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let frameHandle = 0;
    let activeIndex: number | null = null;
    let previousPressed: boolean[] = [];
    let previousAxes: number[] = [];
    let lastFrameTime = performance.now();

    const resetTracking = () => {
      activeIndex = null;
      previousPressed = [];
      previousAxes = [];
    };

    const poll = () => {
      frameHandle = requestAnimationFrame(poll);

      const now = performance.now();
      const deltaMs = now - lastFrameTime;
      lastFrameTime = now;

      const gamepads = readGamepads();
      // Stay with the gamepad we already track; otherwise adopt the first one present.
      const gamepad = (activeIndex !== null ? gamepads[activeIndex] : null)
        ?? gamepads.find((candidate): candidate is Gamepad => candidate !== null && candidate.connected)
        ?? null;

      if (!gamepad) {
        if (activeIndex !== null) {
          resetTracking();
          setDevice(null);
          handlersRef.current.onConnectionChange?.(null, Date.now());
        }
        return;
      }

      if (gamepad.index !== activeIndex) {
        resetTracking();
        activeIndex = gamepad.index;
        const nextDevice = toDevice(gamepad);
        setDevice(nextDevice);
        handlersRef.current.onConnectionChange?.(nextDevice, Date.now());
      }

      // Buttons: emit an event only on a change, so a held button reports once.
      const pressed = gamepad.buttons.map((button) => button.pressed || button.value > 0.5);
      pressed.forEach((isPressed, index) => {
        if (isPressed === (previousPressed[index] ?? false)) {
          return;
        }
        const name = getButtonName(index);
        const timestamp = Date.now();
        if (isPressed) {
          handlersRef.current.onButtonDown?.(name, index, timestamp);
        } else {
          handlersRef.current.onButtonUp?.(name, index, timestamp);
        }
      });
      previousPressed = pressed;

      const axes = gamepad.axes.map((value) => applyDeadzone(value, deadzone));
      const axesChanged = axes.length !== previousAxes.length
        || axes.some((value, index) => Math.abs(value - (previousAxes[index] ?? 0)) > axisEpsilon);
      if (axesChanged) {
        previousAxes = axes;
        handlersRef.current.onAxes?.(axes, Date.now());
      }

      handlersRef.current.onFrame?.({
        device: toDevice(gamepad),
        axes,
        pressed,
        values: gamepad.buttons.map((button) => button.value),
      }, deltaMs);
    };

    frameHandle = requestAnimationFrame(poll);

    return () => {
      cancelAnimationFrame(frameHandle);
    };
    // `gamepadconnected` / `gamepaddisconnected` are deliberately not used: the
    // polling loop already detects both, and listening as well would report each
    // connection twice.
  }, [enabled, deadzone, axisEpsilon]);

  return { device, connected: device !== null };
}
