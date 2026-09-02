import React, { useEffect, useRef } from 'react';
import type { ParsedStringOption } from '../../parser/types';

interface KeyMapperProps {
  options: ParsedStringOption[];
  keys?: string | string[] | Record<string, string>;
  onSelect: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
  autoFocus?: boolean;
}

export function KeyMapper({
  options,
  keys,
  onSelect,
  disabled = false,
  children,
  autoFocus = true,
}: KeyMapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled || !autoFocus) {
      return undefined;
    }

    const focusTimer = setTimeout(() => {
      const { activeElement } = document;

      if (activeElement && activeElement !== document.body && typeof (activeElement as HTMLElement).blur === 'function') {
        (activeElement as HTMLElement).blur();
      }

      const container = containerRef.current;
      if (container) {
        container.focus({ preventScroll: true });
      }
    }, 50);

    return () => clearTimeout(focusTimer);
  }, [disabled, autoFocus, options]);

  useEffect(() => {
    if (disabled || !options || options.length === 0 || !keys) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target && typeof target.getAttribute === 'function') {
        const tagName = target.tagName ? target.tagName.toUpperCase() : '';

        const isInsideContainer = containerRef.current
          ? containerRef.current.contains(target)
          : false;

        const isTextInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) || Boolean(target.isContentEditable);
        const isExternalInteractive = !isInsideContainer && ['BUTTON', 'A'].includes(tagName);

        if (isTextInput || isExternalInteractive) {
          return;
        }
      }

      const pressedKey = (event.key || '').toLowerCase();
      const isSpacePress = pressedKey === ' ' || pressedKey === 'spacebar' || pressedKey === 'space';

      const stopEvent = () => {
        (event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled = true;
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
      };

      const isKeyMatch = (configKey: string) => {
        const keyLower = String(configKey).toLowerCase();
        if (keyLower === 'space' || keyLower === ' ' || keyLower === 'spacebar') {
          return isSpacePress;
        }
        return keyLower === pressedKey;
      };

      const findMatchingOptionValue = (targetVal: string): string | null => {
        const targetLower = String(targetVal).toLowerCase();

        const foundOption = options.find((opt) => {
          if (opt === undefined || opt === null) {
            return false;
          }
          const optValue = typeof opt === 'object' && 'value' in opt
            ? String(opt.value)
            : String(opt);

          return optValue.toLowerCase() === targetLower;
        });

        if (foundOption) {
          return typeof foundOption === 'object' && 'value' in foundOption
            ? String(foundOption.value)
            : String(foundOption);
        }

        return null;
      };

      if (typeof keys === 'object' && !Array.isArray(keys)) {
        for (const [configKey, targetValue] of Object.entries(keys)) {
          if (isKeyMatch(configKey)) {
            const matchedValue = findMatchingOptionValue(targetValue);
            if (matchedValue !== null) {
              stopEvent();
              onSelect(matchedValue);
              return;
            }
          }
        }
        return;
      }

      const keyList = Array.isArray(keys) ? keys : [keys];
      let matchedIndex = -1;

      keyList.forEach((k: string, index: number) => {
        if (isKeyMatch(k) && options[index]) {
          matchedIndex = index;
        }
      });

      if (matchedIndex !== -1) {
        const selectedOption = options[matchedIndex];
        const selectedValue = typeof selectedOption === 'object' && selectedOption !== null && 'value' in selectedOption
          ? String(selectedOption.value)
          : String(selectedOption);

        stopEvent();
        onSelect(selectedValue);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [options, onSelect, disabled, keys]);

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      style={{ display: 'block', outline: 'none' }}
    >
      {children}
    </div>
  );
}
