import {
  cleanup, render, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { KeyMapper } from '../KeyMapper';
import type { ParsedStringOption } from '../../../parser/types';

describe('KeyMapper Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const sampleOptions: ParsedStringOption[] = [
    { label: 'Option A', value: 'a' },
    { label: 'Option B', value: 'b' },
    { label: 'Option C', value: 'c' },
  ];

  test('triggers onSelect with correct value when configured key is pressed', () => {
    const onSelectMock = vi.fn();

    render(
      <KeyMapper
        options={sampleOptions}
        keys={['1', '2', '3']}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: '2' });
    expect(onSelectMock).toHaveBeenCalledTimes(1);
    expect(onSelectMock).toHaveBeenCalledWith('b');
  });

  test('handles case-insensitive letter keypresses', () => {
    const onSelectMock = vi.fn();

    render(
      <KeyMapper
        options={sampleOptions}
        keys={['a', 'b', 'c']}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: 'A' });
    expect(onSelectMock).toHaveBeenCalledWith('a');
  });

  test('supports special keys like Arrow keys and Spacebar', () => {
    const onSelectMock = vi.fn();

    render(
      <KeyMapper
        options={sampleOptions}
        keys={['ArrowLeft', 'ArrowRight', 'Space']}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSelectMock).toHaveBeenCalledWith('b');

    fireEvent.keyDown(window, { key: ' ' });
    expect(onSelectMock).toHaveBeenCalledWith('c');
  });

  test('does not trigger onSelect when component is disabled', () => {
    const onSelectMock = vi.fn();

    render(
      <KeyMapper
        options={sampleOptions}
        keys={['1', '2', '3']}
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
          keys={['1', '2', '3']}
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

    render(
      <KeyMapper
        options={sampleOptions}
        keys={['a', 'b', 'c']}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'a', altKey: true });
    fireEvent.keyDown(window, { key: 'a', metaKey: true });

    expect(onSelectMock).not.toHaveBeenCalled();
  });

  test('prevents multiple KeyMapper components from answering the same keypress', () => {
    const onSelectMock1 = vi.fn();
    const onSelectMock2 = vi.fn();

    render(
      <div>
        <KeyMapper
          options={sampleOptions}
          keys={['1', '2', '3']}
          onSelect={onSelectMock1}
        />
        <KeyMapper
          options={sampleOptions}
          keys={['1', '2', '3']}
          onSelect={onSelectMock2}
        />
      </div>,
    );

    fireEvent.keyDown(window, { key: '1' });

    expect(onSelectMock1).toHaveBeenCalledTimes(1);
    expect(onSelectMock1).toHaveBeenCalledWith('a');
    expect(onSelectMock2).not.toHaveBeenCalled();
  });

  test('stops event propagation in capture phase to prevent secondary global listeners', () => {
    const onSelectMock = vi.fn();
    const secondaryWindowListener = vi.fn();

    window.addEventListener('keydown', secondaryWindowListener);

    render(
      <KeyMapper
        options={sampleOptions}
        keys="Enter"
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onSelectMock).toHaveBeenCalledWith('a');
    expect(secondaryWindowListener).not.toHaveBeenCalled();

    window.removeEventListener('keydown', secondaryWindowListener);
  });

  test('handles a single string key for single-option setups', () => {
    const onSelectMock = vi.fn();

    render(
      <KeyMapper
        options={[{ label: 'Continue', value: 'next' }]}
        keys="Enter"
        onSelect={onSelectMock}
      />,
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelectMock).toHaveBeenCalledWith('next');
  });

  test('does nothing when unmounted', () => {
    const onSelectMock = vi.fn();

    const { unmount } = render(
      <KeyMapper
        options={sampleOptions}
        keys={['1', '2', '3']}
        onSelect={onSelectMock}
      />,
    );

    unmount();

    fireEvent.keyDown(window, { key: '1' });
    expect(onSelectMock).not.toHaveBeenCalled();
  });

  // --- Tests for Object Key-to-Value Mapping ---

  describe('Object Key-to-Value Mapping', () => {
    const stroopOptions: ParsedStringOption[] = [
      { label: 'RED', value: 'red' },
      { label: 'GREEN', value: 'green' },
      { label: 'BLUE', value: 'blue' },
    ];

    const keyMap = {
      r: 'red',
      g: 'green',
      b: 'blue',
    };

    test('triggers onSelect with mapped value when configured object key is pressed', () => {
      const onSelectMock = vi.fn();

      render(
        <KeyMapper
          options={stroopOptions}
          keys={keyMap}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: 'r' });
      expect(onSelectMock).toHaveBeenCalledTimes(1);
      expect(onSelectMock).toHaveBeenCalledWith('red');

      fireEvent.keyDown(window, { key: 'g' });
      expect(onSelectMock).toHaveBeenCalledTimes(2);
      expect(onSelectMock).toHaveBeenCalledWith('green');
    });

    test('handles case-insensitive keypresses with object mappings', () => {
      const onSelectMock = vi.fn();

      render(
        <KeyMapper
          options={stroopOptions}
          keys={keyMap}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: 'B' });
      expect(onSelectMock).toHaveBeenCalledTimes(1);
      expect(onSelectMock).toHaveBeenLastCalledWith('blue');
    });

    test('ignores unmapped random keys in object mode', () => {
      const onSelectMock = vi.fn();

      render(
        <KeyMapper
          options={stroopOptions}
          keys={keyMap}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: 'x' });
      fireEvent.keyDown(window, { key: '9' });
      fireEvent.keyDown(window, { key: 'Enter' });

      expect(onSelectMock).not.toHaveBeenCalled();
    });

    test('supports Spacebar key mapping in object mode', () => {
      const onSelectMock = vi.fn();

      render(
        <KeyMapper
          options={stroopOptions}
          keys={{ Space: 'blue' }}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: ' ' });
      expect(onSelectMock).toHaveBeenCalledWith('blue');
    });

    test('ignores keypress if mapped value does not exist in options', () => {
      const onSelectMock = vi.fn();

      render(
        <KeyMapper
          options={stroopOptions}
          keys={{ y: 'yellow' }}
          onSelect={onSelectMock}
        />,
      );

      fireEvent.keyDown(window, { key: 'y' });
      expect(onSelectMock).not.toHaveBeenCalled();
    });
  });
});
