const MODIFIER_ALIASES: Record<string, string> = {
  shift: 'Shift',
  alt: 'Alt',
  option: 'Alt',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  win: 'Meta',
};

const SPECIAL_KEY_ALIASES: Record<string, string> = {
  space: 'Space',
  enter: 'Enter',
  tab: 'Tab',
  escape: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
};

const MODIFIER_ORDER = ['Shift', 'Alt', 'Ctrl', 'Meta'] as const;

export function normalizeMappingKeyToken(token: string): string | null {
  const value = token.trim();
  if (!value) {
    return null;
  }

  const lower = value.toLowerCase();
  if (SPECIAL_KEY_ALIASES[lower]) {
    return SPECIAL_KEY_ALIASES[lower];
  }

  if (value.length === 1) {
    return value.toUpperCase();
  }

  return null;
}

function normalizeModifierToken(token: string): string | null {
  const value = token.trim();
  if (!value) {
    return null;
  }

  const normalized = MODIFIER_ALIASES[value.toLowerCase()];
  return normalized ?? null;
}

export function normalizeKeyMapping(rawKey: string): string | null {
  const value = rawKey.trim();
  if (!value) {
    return null;
  }

  const parts = value.split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  if (parts.length === 1) {
    const key = normalizeMappingKeyToken(parts[0]);
    return key ?? null;
  }

  const modifiers: string[] = [];
  const lastToken = parts[parts.length - 1];
  const baseKey = normalizeMappingKeyToken(lastToken);
  if (!baseKey) {
    return null;
  }

  // in case we have multiple key mappings due to mac and windows e.g.
  for (let index = 0; index < parts.length - 1; index += 1) {
    const modifier = normalizeModifierToken(parts[index]);
    if (!modifier) {
      return null;
    }
    modifiers.push(modifier);
  }

  const sortedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier));
  return [...sortedModifiers, baseKey].join('+');
}

export function getCanonicalEventKey(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>): string {
  const key = event.key ?? '';
  const modifiers = MODIFIER_ORDER.filter((modifier) => {
    if (modifier === 'Shift') return event.shiftKey;
    if (modifier === 'Alt') return event.altKey;
    if (modifier === 'Ctrl') return event.ctrlKey;
    if (modifier === 'Meta') return event.metaKey;
    return false;
  });

  const normalizedKey = (() => {
    const lower = key.toLowerCase();
    if (SPECIAL_KEY_ALIASES[lower]) {
      return SPECIAL_KEY_ALIASES[lower];
    }
    if (key.length === 1) {
      return key.toUpperCase();
    }
    return key;
  })();

  return [...modifiers, normalizedKey].join('+');
}

export function keyEventMatchesMapping(
  rawKey: string,
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>,
): boolean {
  const expected = normalizeKeyMapping(rawKey);
  const actual = getCanonicalEventKey(event);
  return expected !== null && actual === expected;
}
