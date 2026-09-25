import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Badge, Group, Paper, Stack, Text,
} from '@mantine/core';
import { Registry } from '@trrack/core';
import { StimulusParams } from '../../../store/types';
import { useGamepad } from '../../../store/hooks/useGamepad';
import {
  FACE_BUTTONS,
  FACE_BUTTON_COLORS,
  FACE_BUTTON_TEXT_COLORS,
  type FaceButton,
  gamepadPressActionType,
  isFaceButton,
} from '../../../utils/gamepadButtons';

const FIELD_WIDTH = 640;
const FIELD_HEIGHT = 420;

/** Standard-mapping button indices for the d-pad, offered as an alternative to the stick. */
const DPAD = {
  up: 12, down: 13, left: 14, right: 15,
};

interface GamepadGameParams {
  /** How many targets to present before the task reports itself finished. */
  targetCount?: number;
  /** Reticle speed in pixels per second at full stick deflection. */
  reticleSpeed?: number;
  targetRadius?: number;
}

interface Target {
  index: number;
  x: number;
  y: number;
  button: FaceButton;
  spawnedAt: number;
}

interface Point { x: number; y: number }

/**
 * Provenance state. This is what the analysis view replays, so it holds the
 * semantic state of the game -- which target is up, where the reticle was when a
 * button was pressed, the running tally -- and deliberately not the per-frame
 * reticle path. That continuous motion is left to the screen recording, and to
 * the throttled `gamepadaxis` entries in windowEvents.
 */
interface GameState {
  round: number;
  target: Target | null;
  reticle: Point;
  hits: number;
  misses: number;
  outcome: string;
  completed: boolean;
}

interface PressPayload {
  reticle: Point;
  hit: boolean;
  outcome: string;
  completed: boolean;
}

const INITIAL_STATE: GameState = {
  round: 0,
  target: null,
  reticle: { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 },
  hits: 0,
  misses: 0,
  outcome: 'Waiting for a controller',
  completed: false,
};

function randomTarget(index: number, radius: number): Target {
  const margin = radius + 16;
  return {
    index,
    x: margin + Math.random() * (FIELD_WIDTH - margin * 2),
    y: margin + Math.random() * (FIELD_HEIGHT - margin * 2),
    button: FACE_BUTTONS[Math.floor(Math.random() * FACE_BUTTONS.length)],
    spawnedAt: Date.now(),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function GamepadTargetGame({
  parameters, setAnswer, provenanceState, useTrrack,
}: StimulusParams<GamepadGameParams, GameState>) {
  const {
    targetCount = 8,
    reticleSpeed = 420,
    targetRadius = 34,
  } = parameters;

  // One registered action type per face button. Provenance node colors are derived
  // from the action type, so this is what makes a press show up on the analysis
  // timeline in that button's own color.
  const { actions, registry } = useMemo(() => {
    const reg = Registry.create();

    const applyPress = (state: GameState, payload: PressPayload) => {
      state.reticle = payload.reticle;
      state.outcome = payload.outcome;
      state.completed = payload.completed;
      if (payload.hit) {
        state.hits += 1;
        state.target = null;
      } else {
        state.misses += 1;
      }
      return state;
    };

    // The explicit generics are needed because `state` is annotated; without them
    // Trrack infers the payload type from the state type and the call fails to compile.
    const registerPress = (button: FaceButton) => reg.register<string, string, PressPayload, unknown, GameState>(
      gamepadPressActionType(button),
      applyPress,
    );

    const pressA = registerPress('A');
    const pressB = registerPress('B');
    const pressX = registerPress('X');
    const pressY = registerPress('Y');

    const spawnTarget = reg.register<string, string, Target, unknown, GameState>('gamepad-spawn-target', (state: GameState, target: Target) => {
      state.target = target;
      state.round = target.index;
      state.outcome = `Target ${target.index + 1} of ${targetCount}: press ${target.button}`;
      return state;
    });

    return {
      registry: reg,
      actions: {
        spawnTarget,
        press: {
          A: pressA, B: pressB, X: pressX, Y: pressY,
        } as Record<FaceButton, typeof pressA>,
      },
    };
  }, [targetCount]);

  const trrack = useTrrack({ registry, initialState: INITIAL_STATE });

  const [game, setGame] = useState<GameState>(INITIAL_STATE);
  const [reticle, setReticle] = useState<Point>(INITIAL_STATE.reticle);

  // The reticle is the source of truth for hit-testing and is written every frame,
  // so it lives in a ref; the state mirror exists only to drive rendering.
  const reticleRef = useRef<Point>(INITIAL_STATE.reticle);
  const gameRef = useRef<GameState>(INITIAL_STATE);
  const reactionTimesRef = useRef<number[]>([]);

  const isReplay = provenanceState !== undefined;

  const publishAnswer = useCallback((state: GameState) => {
    const reactionTimes = reactionTimesRef.current;
    const meanReactionTime = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length)
      : null;

    // Status stays true throughout so a participant without a working controller is
    // never trapped on this trial; how far they actually got is recorded in `completed`.
    setAnswer({
      status: true,
      answers: {
        hits: state.hits,
        misses: state.misses,
        meanReactionTime,
        completed: state.completed,
      },
    });
  }, [setAnswer]);

  const commit = useCallback((state: GameState) => {
    gameRef.current = state;
    setGame(state);
  }, []);

  const spawnNext = useCallback((index: number) => {
    const target = randomTarget(index, targetRadius);
    trrack.apply(`Target ${index + 1} (${target.button})`, actions.spawnTarget(target));
    commit({ ...gameRef.current, target, round: index });
  }, [actions, commit, targetRadius, trrack]);

  const handleButtonDown = useCallback((button: string) => {
    if (isReplay || !isFaceButton(button)) {
      return;
    }

    const current = gameRef.current;
    const { target } = current;
    if (!target || current.completed) {
      return;
    }

    const position = reticleRef.current;
    const distance = Math.hypot(position.x - target.x, position.y - target.y);
    const onTarget = distance <= targetRadius;
    const correctButton = button === target.button;
    const hit = onTarget && correctButton;

    if (hit) {
      reactionTimesRef.current.push(Date.now() - target.spawnedAt);
    }

    const nextRound = hit ? target.index + 1 : target.index;
    const completed = hit && nextRound >= targetCount;

    let outcome: string;
    if (hit) {
      outcome = completed ? `Hit ${button} — task complete` : `Hit ${button}`;
    } else if (!correctButton) {
      outcome = `Miss — pressed ${button}, target wants ${target.button}`;
    } else {
      outcome = `Miss — ${button} pressed off target`;
    }

    trrack.apply(`Pressed ${button} — ${hit ? 'hit' : 'miss'}`, actions.press[button]({
      reticle: position,
      hit,
      outcome,
      completed,
    }));

    const nextState: GameState = {
      ...current,
      reticle: position,
      hits: current.hits + (hit ? 1 : 0),
      misses: current.misses + (hit ? 0 : 1),
      target: hit ? null : target,
      outcome,
      completed,
    };
    commit(nextState);
    publishAnswer(nextState);

    if (hit && !completed) {
      spawnNext(nextRound);
    }
  }, [actions, commit, isReplay, publishAnswer, spawnNext, targetCount, targetRadius, trrack]);

  // Moves the reticle. A held stick reports the same axis value every frame, so this
  // has to integrate per frame rather than react to axis-change events.
  const handleFrame = useCallback(({ axes, pressed }: { axes: number[]; pressed: boolean[] }, deltaMs: number) => {
    if (isReplay) {
      return;
    }

    const dpadX = (pressed[DPAD.right] ? 1 : 0) - (pressed[DPAD.left] ? 1 : 0);
    const dpadY = (pressed[DPAD.down] ? 1 : 0) - (pressed[DPAD.up] ? 1 : 0);
    const dx = clamp((axes[0] ?? 0) + dpadX, -1, 1);
    const dy = clamp((axes[1] ?? 0) + dpadY, -1, 1);

    if (dx === 0 && dy === 0) {
      return;
    }

    const step = (reticleSpeed * deltaMs) / 1000;
    const next = {
      x: clamp(reticleRef.current.x + dx * step, 0, FIELD_WIDTH),
      y: clamp(reticleRef.current.y + dy * step, 0, FIELD_HEIGHT),
    };
    reticleRef.current = next;
    setReticle(next);
  }, [isReplay, reticleSpeed]);

  const { device, connected } = useGamepad({
    onButtonDown: handleButtonDown,
    onFrame: handleFrame,
    enabled: !isReplay,
  });

  // Start the task as soon as a controller announces itself.
  useEffect(() => {
    if (isReplay || !connected || gameRef.current.target || gameRef.current.completed) {
      return;
    }
    spawnNext(0);
  }, [connected, isReplay, spawnNext]);

  // During replay the analysis view drives the scene through provenanceState.
  useEffect(() => {
    if (!provenanceState) {
      return;
    }
    gameRef.current = provenanceState;
    reticleRef.current = provenanceState.reticle;
    setGame(provenanceState);
    setReticle(provenanceState.reticle);
  }, [provenanceState]);

  const { target } = game;
  const onTarget = target
    ? Math.hypot(reticle.x - target.x, reticle.y - target.y) <= targetRadius
    : false;

  return (
    <Stack gap="md" align="center">
      <Group gap="xs">
        {FACE_BUTTONS.map((button) => (
          <Badge
            key={button}
            size="lg"
            radius="sm"
            styles={{ root: { backgroundColor: FACE_BUTTON_COLORS[button], color: FACE_BUTTON_TEXT_COLORS[button] } }}
          >
            {button}
          </Badge>
        ))}
      </Group>

      <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden', lineHeight: 0 }}>
        <svg width={FIELD_WIDTH} height={FIELD_HEIGHT} role="img" aria-label="Gamepad target field">
          <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="#f5f6f8" />

          {target && (
            <g data-testid="gamepad-target" data-button={target.button} data-x={target.x} data-y={target.y}>
              <circle
                cx={target.x}
                cy={target.y}
                r={targetRadius}
                fill={FACE_BUTTON_COLORS[target.button]}
                stroke={onTarget ? '#111' : 'none'}
                strokeWidth={3}
              />
              <text
                x={target.x}
                y={target.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={26}
                fontWeight={700}
                fill={FACE_BUTTON_TEXT_COLORS[target.button]}
              >
                {target.button}
              </text>
            </g>
          )}

          <g data-testid="gamepad-reticle" data-x={reticle.x} data-y={reticle.y} stroke="#111" strokeWidth={2} fill="none">
            <circle cx={reticle.x} cy={reticle.y} r={11} />
            <line x1={reticle.x - 18} x2={reticle.x - 4} y1={reticle.y} y2={reticle.y} />
            <line x1={reticle.x + 4} x2={reticle.x + 18} y1={reticle.y} y2={reticle.y} />
            <line x1={reticle.x} x2={reticle.x} y1={reticle.y - 18} y2={reticle.y - 4} />
            <line x1={reticle.x} x2={reticle.x} y1={reticle.y + 4} y2={reticle.y + 18} />
          </g>

          {!connected && !isReplay && (
            <g>
              <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="rgba(255,255,255,0.86)" />
              <text x={FIELD_WIDTH / 2} y={FIELD_HEIGHT / 2 - 12} textAnchor="middle" fontSize={20} fontWeight={600} fill="#111">
                Press any button on your controller
              </text>
              <text x={FIELD_WIDTH / 2} y={FIELD_HEIGHT / 2 + 18} textAnchor="middle" fontSize={14} fill="#555">
                Browsers hide gamepads from a page until it receives gamepad input.
              </text>
            </g>
          )}
        </svg>
      </Paper>

      <Group gap="xl">
        <Text size="sm">
          Round
          {' '}
          <strong>{Math.min(game.round + 1, targetCount)}</strong>
          {' / '}
          {targetCount}
        </Text>
        <Text size="sm">
          Hits
          {' '}
          <strong data-testid="gamepad-hits">{game.hits}</strong>
        </Text>
        <Text size="sm">
          Misses
          {' '}
          <strong data-testid="gamepad-misses">{game.misses}</strong>
        </Text>
      </Group>

      <Text size="sm" c="dimmed" data-testid="gamepad-outcome">{game.outcome}</Text>

      {device && (
        <Text size="xs" c="dimmed">
          {device.id}
          {' — mapping: '}
          {device.mapping || 'non-standard'}
        </Text>
      )}
    </Stack>
  );
}

export default GamepadTargetGame;
