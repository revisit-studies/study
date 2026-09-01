import { useEffect } from 'react';
import type { ParsedStringOption } from '../../parser/types';

interface KeyMapperProps {
  options: ParsedStringOption[];
  keys?: string | string[] | Record<string, string>;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export function KeyMapper({
  options, keys, onSelect, disabled = false,
}: KeyMapperProps) {
  useEffect(() => {
    if (disabled || !options || options.length === 0 || !keys) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      const pressedKey = event.key.toLowerCase();
      const isSpace = pressedKey === ' ' || pressedKey === 'spacebar';

      // 1. Handle Key-to-Value Mapping Object: { "r": "red", "g": "green" }
      if (typeof keys === 'object' && !Array.isArray(keys)) {
        Object.entries(keys).forEach(([configKey, targetValue]) => {
          const keyLower = configKey.toLowerCase();
          const matches = keyLower === pressedKey || ((keyLower === 'space' || keyLower === ' ') && isSpace);

          const isValidOption = options.some((opt) => opt.value === targetValue);

          if (matches && isValidOption) {
            event.preventDefault();
            onSelect(targetValue);
          }
        });
        return;
      }

      // 2. Handle Sequential Mapping: Array ["1", "2"] or single string "Enter"
      const keyList = Array.isArray(keys) ? keys : [keys];

      keyList.forEach((k: string, index: number) => {
        const configKey = k.toLowerCase();
        const matches = configKey === pressedKey || ((configKey === 'space' || configKey === ' ') && isSpace);

        if (matches && options[index]) {
          event.preventDefault();
          onSelect(options[index].value);
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, keys, onSelect, disabled]);

  return null;
}
