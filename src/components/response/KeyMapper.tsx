import { useEffect } from 'react';
import type { ParsedStringOption } from '../../parser/types';
import { keyEventMatchesMapping } from '../../utils/keyMapping';

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

      const isArrowKey = ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key);
      if (isArrowKey && target instanceof Element && target.closest('[role="radio"]')) {
        return;
      }

      if (isArrowKey && document.activeElement === document.body && onArrowNavigation) {
        (event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled = true;
        event.preventDefault();
        onArrowNavigation();
        return;
      }

      for (const option of options) {
        if (typeof option === 'object' && option !== null && option.key) {
          if (keyEventMatchesMapping(option.key, event)) {
            (event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled = true;

            if (typeof event.preventDefault === 'function') {
              event.preventDefault();
            }
            onSelect(String(option.value), 'keyboard');
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [disabled, onArrowNavigation, onSelect, options]);

  return null;
}
