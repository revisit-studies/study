import {
  cleanup, render, fireEvent, act,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import React from 'react';
import { KeyMapper } from '../KeyMapper';
import type { ParsedStringOption } from '../../../parser/types';

describe('KeyMapper Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const sampleOptions: ParsedStringOption[] = [
    { label: 'Option A', value: 'a', key: '1' },
    { label: 'Option B', value: 'b', key: '2' },
    { label: 'Option C', value: 'c', key: '3' },
  ];

  test('triggers onSelect with correct value when configured key is pressed', () => {
    const onSelectMock = vi.fn();

    render(
      <KeyMapper
        options={sampleOptions}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: '2' });
    expect(onSelectMock).toHaveBeenCalledTimes(1);
    expect(onSelectMock).toHaveBeenCalledWith('b', 'keyboard');
  });

  test('handles case-insensitive letter keypresses', () => {
    const onSelectMock = vi.fn();
    const letterOptions: ParsedStringOption[] = [
      { label: 'Option A', value: 'a', key: 'a' },
      { label: 'Option B', value: 'b', key: 'b' },
      { label: 'Option C', value: 'c', key: 'c' },
    ];

    render(
      <KeyMapper
        options={letterOptions}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: 'A' });
    expect(onSelectMock).toHaveBeenCalledWith('a', 'keyboard');
  });

  test('supports special keys like Arrow keys and Spacebar', () => {
    const onSelectMock = vi.fn();
    const specialOptions: ParsedStringOption[] = [
      { label: 'Option A', value: 'a', key: 'ArrowLeft' },
      { label: 'Option B', value: 'b', key: 'ArrowRight' },
      { label: 'Option C', value: 'c', key: 'Space' },
    ];

    render(
      <KeyMapper
        options={specialOptions}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSelectMock).toHaveBeenCalledWith('b', 'keyboard');

    fireEvent.keyDown(window, { key: 'space' });
    expect(onSelectMock).toHaveBeenCalledWith('c', 'keyboard');
  });

  test('matches canonical Shift+X combinations without swallowing plain x', () => {
    const onSelectMock = vi.fn();

    render(
      <KeyMapper
        options={[{ label: 'Option A', value: 'a', key: 'Shift+X' }]}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: 'x' });
    expect(onSelectMock).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'X', shiftKey: true });
    expect(onSelectMock).toHaveBeenCalledTimes(1);
    expect(onSelectMock).toHaveBeenCalledWith('a', 'keyboard');
  });

  test('ignores keyboard shortcuts while focus is on a response option inside the same group', () => {
    const onSelectMock = vi.fn();
    const focusRootRef = { current: null as HTMLDivElement | null };

    const { container } = render(
      <div ref={(node) => { focusRootRef.current = node; }}>
        <button type="button">Visible option</button>
        <KeyMapper
          options={[{ label: 'Option B', value: 'b', key: 'b' }]}
          onSelect={onSelectMock}
          focusRootRef={focusRootRef}
        />
      </div>,
    );

    const option = container.querySelector('button')!;
    option.focus();
    fireEvent.keyDown(window, { key: 'b' });
    expect(onSelectMock).not.toHaveBeenCalled();
  });

  test('does not trigger onSelect when component is disabled', () => {
    const onSelectMock = vi.fn();

    render(
      <KeyMapper
        options={sampleOptions}
        onSelect={onSelectMock}
        disabled
      />,
    );

    fireEvent.keyDown(window, { key: '1' });
    expect(onSelectMock).not.toHaveBeenCalled();
  });

  test('ignores keypresses coming from form inputs, text areas, buttons, or links', () => {
    const onSelectMock = vi.fn();

    render(
      <div>
        <input data-testid="text-input" type="text" />
        <button type="button" data-testid="next-btn">Next</button>
        <a href="#test" data-testid="link">Link</a>
        <KeyMapper
          options={sampleOptions}
          onSelect={onSelectMock}
        />
      </div>,
    );

    const input = document.querySelector('input')!;
    const button = document.querySelector('button')!;
    const link = document.querySelector('a')!;

    fireEvent.keyDown(input, { key: '1' });
    expect(onSelectMock).not.toHaveBeenCalled();

    fireEvent.keyDown(button, { key: '2' });
    expect(onSelectMock).not.toHaveBeenCalled();

    fireEvent.keyDown(link, { key: '3' });
    expect(onSelectMock).not.toHaveBeenCalled();
  });

  test('ignores keypresses with modifier keys (Ctrl, Alt, Meta)', () => {
    const onSelectMock = vi.fn();
    const letterOptions: ParsedStringOption[] = [
      { label: 'Option A', value: 'a', key: 'a' },
      { label: 'Option B', value: 'b', key: 'b' },
      { label: 'Option C', value: 'c', key: 'c' },
    ];

    render(
      <KeyMapper
        options={letterOptions}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'a', altKey: true });
    fireEvent.keyDown(window, { key: 'a', metaKey: true });

    expect(onSelectMock).not.toHaveBeenCalled();
  });

  test('prevents multiple KeyMapper components from answering the same keypress using event tagging', () => {
    const onSelectMock1 = vi.fn();
    const onSelectMock2 = vi.fn();

    render(
      <div>
        <KeyMapper
          options={sampleOptions}
          onSelect={onSelectMock1}
        />
        <KeyMapper
          options={sampleOptions}
          onSelect={onSelectMock2}
        />
      </div>,
    );

    fireEvent.keyDown(window, { key: '1' });

    expect(onSelectMock1).toHaveBeenCalledTimes(1);
    expect(onSelectMock1).toHaveBeenCalledWith('a', 'keyboard');
    expect(onSelectMock2).not.toHaveBeenCalled();
  });

  test('preserves keydown events for secondary global instrumentation listeners', () => {
    const onSelectMock = vi.fn();
    const secondaryWindowListener = vi.fn();

    window.addEventListener('keydown', secondaryWindowListener);

    render(
      <KeyMapper
        options={[{ label: 'Continue', value: 'next', key: 'Enter' }]}
        onSelect={onSelectMock}
      />,
    );

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    window.dispatchEvent(event);

    expect(onSelectMock).toHaveBeenCalledWith('next', 'keyboard');
    expect(secondaryWindowListener).toHaveBeenCalledTimes(1);
    expect((event as unknown as { __keyMapperHandled?: boolean }).__keyMapperHandled).toBe(true);

    window.removeEventListener('keydown', secondaryWindowListener);
  });

  test('handles a single option setup with mapped key', () => {
    const onSelectMock = vi.fn();

    render(
      <KeyMapper
        options={[{ label: 'Continue', value: 'next', key: 'Enter' }]}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelectMock).toHaveBeenCalledWith('next', 'keyboard');
  });

  test('does not steal focus or autofocus when option keys are absent', () => {
    const onSelectMock = vi.fn();
    const optionsWithoutKeys: ParsedStringOption[] = [
      { label: 'Option A', value: 'a' },
      { label: 'Option B', value: 'b' },
    ];

    const { container } = render(
      <div>
        <input data-testid="external-input" />
        <KeyMapper
          options={optionsWithoutKeys}
          onSelect={onSelectMock}
        />
      </div>,
    );

    const input = container.querySelector('input')!;
    input.focus();
    expect(document.activeElement).toBe(input);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(document.activeElement).toBe(input);
  });

  test('does nothing when unmounted', () => {
    const onSelectMock = vi.fn();

    const { unmount } = render(
      <KeyMapper
        options={sampleOptions}
        onSelect={onSelectMock}
      />,
    );

    unmount();

    fireEvent.keyDown(window, { key: '1' });
    expect(onSelectMock).not.toHaveBeenCalled();
  });

  // --- Tests for Inline Key Mappings ---

  describe('Inline Key Mappings', () => {
    const stroopOptions: ParsedStringOption[] = [
      { label: 'RED', value: 'red', key: 'r' },
      { label: 'GREEN', value: 'green', key: 'g' },
      { label: 'BLUE', value: 'blue', key: 'b' },
    ];

    test('matches exact option values when inline key is pressed', () => {
      const onSelectMock = vi.fn();

      render(
        <KeyMapper
          options={stroopOptions}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: 'r' });
      expect(onSelectMock).toHaveBeenCalledTimes(1);
      expect(onSelectMock).toHaveBeenCalledWith('red', 'keyboard');

      fireEvent.keyDown(window, { key: 'g' });
      expect(onSelectMock).toHaveBeenCalledTimes(2);
      expect(onSelectMock).toHaveBeenCalledWith('green', 'keyboard');
    });

    test('handles case-insensitive keypresses with inline option keys', () => {
      const onSelectMock = vi.fn();

      render(
        <KeyMapper
          options={stroopOptions}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: 'B' });
      expect(onSelectMock).toHaveBeenCalledTimes(1);
      expect(onSelectMock).toHaveBeenLastCalledWith('blue', 'keyboard');
    });

    test('ignores unmapped keys', () => {
      const onSelectMock = vi.fn();

      render(
        <KeyMapper
          options={stroopOptions}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: 'x' });
      fireEvent.keyDown(window, { key: '9' });
      fireEvent.keyDown(window, { key: 'Enter' });

      expect(onSelectMock).not.toHaveBeenCalled();
    });

    test('supports Space key mapping', () => {
      const onSelectMock = vi.fn();
      const optionsWithSpace: ParsedStringOption[] = [
        { label: 'BLUE', value: 'blue', key: 'Space' },
      ];

      render(
        <KeyMapper
          options={optionsWithSpace}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: 'space' });
      expect(onSelectMock).toHaveBeenCalledWith('blue', 'keyboard');
    });
  });

  // --- Edge Cases & Additional Behaviors ---

  describe('Edge Cases', () => {
    test('ignores held key repetition (repeat = true)', () => {
      const onSelectMock = vi.fn();

      render(
        <KeyMapper
          options={sampleOptions}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: '1', repeat: false });
      fireEvent.keyDown(window, { key: '1', repeat: true });
      fireEvent.keyDown(window, { key: '1', repeat: true });

      expect(onSelectMock).toHaveBeenCalledTimes(1);
    });

    test('updates key bindings dynamically when options prop changes', () => {
      const onSelectMock = vi.fn();

      const { rerender } = render(
        <KeyMapper
          options={sampleOptions}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: '1' });
      expect(onSelectMock).toHaveBeenLastCalledWith('a', 'keyboard');

      const updatedOptions: ParsedStringOption[] = [
        { label: 'New Option X', value: 'x', key: '1' },
      ];

      rerender(
        <KeyMapper
          options={updatedOptions}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: '1' });
      expect(onSelectMock).toHaveBeenLastCalledWith('x', 'keyboard');
    });

    test('does not render any extra controls for options with keys', () => {
      const onSelectMock = vi.fn();
      const { container } = render(
        <KeyMapper options={sampleOptions} onSelect={onSelectMock} />,
      );
      expect(container.querySelectorAll('button')).toHaveLength(0);
      expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
      expect(container.firstChild?.textContent).toBe('');
    });
  });
});
