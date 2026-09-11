import React, { useEffect, useRef } from 'react';
import type { ParsedStringOption } from '../../parser/types';
import { keyEventMatchesMapping } from '../../utils/keyMapping';

interface KeyMapperProps {
  options: ParsedStringOption[];
  onSelect: (value: string, source?: 'keyboard' | 'click') => void;
  disabled?: boolean;
  children?: React.ReactNode;
  autoFocus?: boolean;
  focusRootRef?: React.RefObject<HTMLElement | null>;
}

export function KeyMapper({
  options,
  onSelect,
  disabled = false,
  children,
  autoFocus = false,
  focusRootRef,
}: KeyMapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoFocus || !options?.some((opt) => typeof opt === 'object' && opt !== null && Boolean(opt.key))) {
      return undefined;
    }

    const timer = setTimeout(() => {
      const { activeElement } = document;
      if (containerRef.current && (!activeElement || !(activeElement instanceof HTMLElement) || !focusRootRef?.current?.contains(activeElement))) {
        containerRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [autoFocus, focusRootRef, options]);

  useEffect(() => {
    if (disabled || !options || options.length === 0) {
      return undefined;
    }

    const isOwnedTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) {
        return false;
      }
      return Boolean(focusRootRef?.current && focusRootRef.current.contains(target));
    };

    const isEditableOrInteractiveTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      if (target.isContentEditable) {
        return true;
      }
      return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // currently ctrl win, meta, command and ctrl are not supported
      if (event.repeat || event.ctrlKey || event.metaKey) {
        return;
      }

      if ((event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled) {
        return;
      }

      if (isEditableOrInteractiveTarget(event.target)) {
        return;
      }

      if (isOwnedTarget(event.target) || isOwnedTarget(document.activeElement)) {
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
  }, [disabled, focusRootRef, onSelect, options]);

  return <div>{children}</div>;
}
