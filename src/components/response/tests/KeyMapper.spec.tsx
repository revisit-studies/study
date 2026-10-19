import { cleanup, render, fireEvent } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import React from 'react';
import { MantineProvider, Radio } from '@mantine/core';
import { KeyMapper } from '../KeyMapper';
import type { ParsedStringOption } from '../../../parser/types';

describe('KeyMapper Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const sampleOptions: ParsedStringOption[] = [
    { label: 'Option A', value: 'a', key: '1' },
    { label: 'Option B', value: 'b', key: '2' },
    { label: 'Option C', value: 'c', key: '3' },
    { label: 'Continue', value: 'continue', key: 'Enter' },
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

    fireEvent.keyDown(window, { key: ' ' });
    expect(onSelectMock).toHaveBeenCalledWith('c', 'keyboard');
  });

  test.each(['page', 'card'])('prioritizes mapped arrows over navigation with focus on the %s', (focusTarget) => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    const onSelect = vi.fn();
    const onArrowNavigation = vi.fn();
    const onGroupChange = vi.fn();
    const options: ParsedStringOption[] = [
      { label: 'Left', value: 'left', key: 'ArrowLeft' },
      { label: 'Right', value: 'right', key: 'ArrowRight' },
      { label: 'Down', value: 'down', key: 'ArrowDown' },
    ];
    const { getByRole } = render(
      <MantineProvider env="test">
        <Radio.Group name="mapped-arrows" value="left" onChange={onGroupChange}>
          <KeyMapper options={options} onSelect={onSelect} onArrowNavigation={onArrowNavigation} />
          {options.map((option) => <Radio.Card key={option.value} value={option.value}>{option.label}</Radio.Card>)}
        </Radio.Group>
      </MantineProvider>,
    );
    const target = focusTarget === 'card' ? getByRole('radio', { name: 'Left' }) : document.body;
    if (focusTarget === 'card') target.focus();

    fireEvent.keyDown(target, {
      key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true,
    });

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('down', 'keyboard');
    expect(onArrowNavigation).not.toHaveBeenCalled();
    expect(onGroupChange).not.toHaveBeenCalled();
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

  test('ignores keypresses from text-entry controls and native Enter targets', () => {
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
    expect(onSelectMock).toHaveBeenCalledWith('b', 'keyboard');

    fireEvent.keyDown(link, { key: 'Enter' });
    expect(onSelectMock).toHaveBeenCalledTimes(1);
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

  test.each(['Enter', 'Space'])('does not take %s from a focused action button in its response', (key) => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <div>
        <button type="button">Clear selection</button>
        <KeyMapper options={[{ label: 'A', value: 'a', key }]} onSelect={onSelect} />
      </div>,
    );
    const button = getByRole('button', { name: 'Clear selection' });
    button.focus();

    const event = new KeyboardEvent('keydown', { key: key === 'Space' ? ' ' : key, bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    expect(onSelect).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test('does not take Space from a focused Next button', () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <>
        <button type="button">Next</button>
        <KeyMapper options={[{ label: 'A', value: 'a', key: 'Space' }]} onSelect={onSelect} />
      </>,
    );
    const button = getByRole('button', { name: 'Next' });
    button.focus();

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    expect(onSelect).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test('never prevents Tab focus navigation', () => {
    const onSelect = vi.fn();
    render(<KeyMapper options={[{ label: 'A', value: 'a', key: 'Tab' }]} onSelect={onSelect} />);
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    expect(onSelect).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
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
  });
});
