import { useEffect } from 'react';
import type { ParsedStringOption } from '../../parser/types';
import { keyEventMatchesMapping } from '../../utils/keyMapping';

const ARROW_KEYS = ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];

interface KeyMapperProps {
  options: ParsedStringOption[];
  onSelect: (value: string, source?: 'keyboard' | 'click') => void;
  onArrowNavigation?: () => void;
  disabled?: boolean;
}

export function KeyMapper({
  options,
  onSelect,
  onArrowNavigation,
  disabled = false,
}: KeyMapperProps) {
  useEffect(() => {
    if (disabled || !options || options.length === 0) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key === 'Tab' || event.ctrlKey || event.metaKey) {
        return;
      }

      if ((event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled) {
        return;
      }

      const target = event.target instanceof Element ? event.target : document.activeElement;
      if (target instanceof Element && (
        (target instanceof HTMLElement && target.isContentEditable)
        || target.closest('input, textarea, select')
        || ((event.key === 'Enter' || event.key === ' ')
          && target.closest('button, a[href], [role="button"]') && !target.closest('[role="radio"]'))
      )) {
        return;
      }

      const isArrowKey = ARROW_KEYS.includes(event.key);
      for (const option of options) {
        if (typeof option === 'object' && option !== null && option.key) {
          if (keyEventMatchesMapping(option.key, event)) {
            (event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled = true;

            if (typeof event.preventDefault === 'function') {
              event.preventDefault();
            }
            if (isArrowKey && target instanceof Element && target.closest('[role="radio"]')) {
              // Mantine's arrow handler would otherwise overwrite the mapped answer.
              event.stopPropagation();
            }
            onSelect(String(option.value), 'keyboard');
            return;
          }
        }
      }
    };

    const handleArrowNavigation = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.defaultPrevented
        || (event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled) {
        return;
      }

      if (ARROW_KEYS.includes(event.key) && document.activeElement === document.body && onArrowNavigation) {
        (event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled = true;
        event.preventDefault();
        onArrowNavigation();
      }
    };

    // Explicit mappings in every response run before the navigation fallback.
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keydown', handleArrowNavigation);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleArrowNavigation);
    };
  }, [disabled, onArrowNavigation, onSelect, options]);

  return null;
}
