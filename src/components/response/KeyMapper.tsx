import React, { useEffect, useRef } from 'react';
import type { ParsedStringOption } from '../../parser/types';

interface KeyMapperProps {
  options: ParsedStringOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
  autoFocus?: boolean;
}

export function KeyMapper({
  options,
  onSelect,
  disabled = false,
  children,
  autoFocus = true,
}: KeyMapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasInlineKeys = options?.some(
      (opt) => typeof opt === 'object' && opt !== null && Boolean(opt.key),
    );

    const timer = setTimeout(() => {
      if (autoFocus && hasInlineKeys && containerRef.current) {
        containerRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [options, autoFocus]);

  useEffect(() => {
    if (disabled || !options || options.length === 0) {
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
      if (event.repeat) {
        return;
      }

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

      const isKeyMatch = (configKey: string) => {
        const keyLower = String(configKey).toLowerCase();
        if (keyLower === 'space' || keyLower === ' ' || keyLower === 'spacebar') {
          return isSpacePress;
        }
        return keyLower === pressedKey;
      };

      // Find the first option whose inline `key` matches the physical key press
      for (const option of options) {
        if (typeof option === 'object' && option !== null && option.key) {
          if (isKeyMatch(option.key)) {
            (event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled = true;

            if (typeof event.preventDefault === 'function') {
              event.preventDefault();
            }

            onSelect(String(option.value));
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [options, onSelect, disabled]);

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      style={{ display: 'block', outline: 'none' }}
    >
      {/* Screen-reader accessible hidden buttons for keyboard options */}
      {options
        ?.filter((option) => option.key)
        .map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={disabled}
            style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: 0,
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
            onClick={() => onSelect?.(option.value)}
          >
            {option.label}
          </button>
        ))}

      {children}
    </div>
  );
}
