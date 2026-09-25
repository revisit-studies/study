/**
 * Shared vocabulary for gamepad input.
 *
 * Both the study stimulus (which draws targets in button colors) and the
 * analysis provenance timeline (which colors nodes by the button that was
 * pressed) import from here, so the two always agree on what "the B button"
 * looks like.
 */

/**
 * Button names for the W3C "standard" gamepad mapping, indexed by the position
 * they occupy in `Gamepad.buttons`. Xbox controllers report `mapping: "standard"`
 * on every browser we target, but a controller that reports an empty mapping may
 * order its buttons differently — always check `mapping` before trusting these
 * names in analysis.
 */
export const STANDARD_BUTTON_NAMES = [
  'A', 'B', 'X', 'Y',
  'LB', 'RB', 'LT', 'RT',
  'Back', 'Start',
  'LeftStick', 'RightStick',
  'DpadUp', 'DpadDown', 'DpadLeft', 'DpadRight',
  'Guide',
] as const;

/** The four face buttons, which are the only ones the demo game uses. */
export const FACE_BUTTONS = ['A', 'B', 'X', 'Y'] as const;

export type FaceButton = typeof FACE_BUTTONS[number];

/** Xbox face-button colors, used for both the game UI and the provenance timeline. */
export const FACE_BUTTON_COLORS: Record<FaceButton, string> = {
  A: '#107c10',
  B: '#d13438',
  X: '#0078d4',
  Y: '#ffb900',
};

/** A readable contrast color for text drawn on top of {@link FACE_BUTTON_COLORS}. */
export const FACE_BUTTON_TEXT_COLORS: Record<FaceButton, string> = {
  A: '#ffffff',
  B: '#ffffff',
  X: '#ffffff',
  Y: '#000000',
};

export function isFaceButton(name: string): name is FaceButton {
  return (FACE_BUTTONS as readonly string[]).includes(name);
}

/**
 * Resolves a `Gamepad.buttons` index to a human-readable name. Indices beyond the
 * standard mapping keep their raw position so unusual controllers stay traceable.
 */
export function getButtonName(index: number): string {
  return STANDARD_BUTTON_NAMES[index] ?? `Button${index}`;
}

/**
 * The Trrack action type used when a face button is pressed.
 *
 * Provenance node colors are derived from the action type, so this naming
 * convention is what lets the analysis timeline paint a node in its button's
 * color. See `EXPLICIT_KEY_COLORS` in `components/audioAnalysis/provenanceColors.ts`.
 */
export function gamepadPressActionType(button: string): string {
  return `gamepad-press-${button.toLowerCase()}`;
}
