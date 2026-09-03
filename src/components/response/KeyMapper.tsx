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
    const hasKeys = keys && (typeof keys === 'string' || Object.keys(keys).length > 0);
    const timer = setTimeout(() => {
      if (autoFocus && hasKeys && containerRef.current) {
        containerRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [keys, autoFocus]);

  useEffect(() => {
    if (disabled || !options || options.length === 0 || !keys) {
      return undefined;
    }

    const isInteractiveElement = (node: EventTarget | null): boolean => {
      if (!node || !(node instanceof Element) || node === document.body) {
        return false;
      }

      const tagName = node.tagName.toLowerCase();
      const isInput = ['input', 'textarea', 'select', 'button', 'a'].includes(tagName);
      const isRoleButton = node.getAttribute?.('role') === 'button';
      const isContentEditable = (node as HTMLElement).isContentEditable ?? false;

      if (isInput || isRoleButton || isContentEditable) {
        const isInsideMapperContainer = containerRef.current?.contains(node) ?? false;
        return !isInsideMapperContainer;
      }

      return false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const eventTarget = event.target;

      if (isInteractiveElement(eventTarget) || isInteractiveElement(activeEl)) {
        return;
      }

      if ((event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const pressedKey = (event.key || '').toLowerCase();
      const isSpacePress = pressedKey === ' ' || pressedKey === 'spacebar' || pressedKey === 'space';

      const handleMatchedSelection = (selectedValue: string) => {
        (event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled = true;

        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }

        onSelect(selectedValue);
      };

      const isKeyMatch = (configKey: string) => {
        const keyLower = String(configKey).toLowerCase();
        if (keyLower === 'space' || keyLower === ' ' || keyLower === 'spacebar') {
          return isSpacePress;
        }
        return keyLower === pressedKey;
      };

      const findMatchingOptionValue = (targetVal: string): string | null => {
        const targetString = String(targetVal);

        const foundOption = options.find((opt) => {
          if (opt === undefined || opt === null) {
            return false;
          }
          const optValue = typeof opt === 'object' && 'value' in opt
            ? String(opt.value)
            : String(opt);

          return optValue === targetString;
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
              handleMatchedSelection(matchedValue);
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

        handleMatchedSelection(selectedValue);
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
