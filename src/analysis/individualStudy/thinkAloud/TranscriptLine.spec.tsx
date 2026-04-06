import { ReactNode } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { TranscriptLine } from './TranscriptLine';
import type { Tag } from './types';

vi.mock('@mantine/core', () => ({
  Grid: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Col: ({ children, ref: _r, ...rest }: { children: ReactNode; ref?: unknown }) => <div {...rest}>{children}</div> },
  ),
  Group: ({ children, style }: { children: ReactNode; style?: object }) => <div style={style}>{children}</div>,
  Textarea: ({
    value, onChange, onKeyDown, onFocus, ref: _r, placeholder, onBlur,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
    onFocus?: React.FocusEventHandler<HTMLTextAreaElement>;
    ref?: unknown;
    placeholder?: string;
    onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
  }) => (
    <textarea
      data-testid="textarea"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      onBlur={onBlur}
    />
  ),
}));

vi.mock('@mantine/hooks', () => ({
  useResizeObserver: () => [{ current: null }, { width: 200 }],
}));

vi.mock('./tags/TagSelector', () => ({
  TagSelector: () => <div data-testid="tag-selector" />,
}));

const defaultProps = {
  annotation: '',
  setAnnotation: vi.fn(),
  start: 0,
  current: 5,
  end: 10,
  text: 'Hello world',
  tags: [] as Tag[],
  selectedTags: [] as Tag[],
  onTextChange: vi.fn(),
  deleteRowCallback: vi.fn(),
  addRowCallback: vi.fn(),
  onSelectTags: vi.fn(),
  addRef: vi.fn(),
  index: 0,
  editTagCallback: vi.fn(),
  createTagCallback: vi.fn(),
  onClickLine: vi.fn(),
};

afterEach(() => { cleanup(); });

describe('TranscriptLine', () => {
  test('renders text content', () => {
    const { getAllByTestId } = render(<TranscriptLine {...defaultProps} />);
    const textareas = getAllByTestId('textarea');
    expect(textareas[0].getAttribute('value') ?? (textareas[0] as HTMLTextAreaElement).value).toBe('Hello world');
  });

  test('applies highlight style when current is within start–end range', () => {
    const { container } = render(
      <TranscriptLine {...defaultProps} start={0} current={5} end={10} />,
    );
    expect(container.innerHTML).toContain('rgba(100, 149, 237, 0.3)');
  });

  test('does not apply highlight when current is outside range', () => {
    const { container } = render(
      <TranscriptLine {...defaultProps} start={0} current={20} end={10} />,
    );
    expect(container.innerHTML).not.toContain('rgba(100, 149, 237, 0.3)');
  });

  test('Enter keydown calls addRowCallback', () => {
    const addRowCallback = vi.fn();
    const { getAllByTestId } = render(
      <TranscriptLine {...defaultProps} addRowCallback={addRowCallback} />,
    );
    const textarea = getAllByTestId('textarea')[0] as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'selectionStart', { value: 3, configurable: true });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(addRowCallback).toHaveBeenCalledWith(0, 3);
  });

  test('Backspace at position 0 calls deleteRowCallback', () => {
    const deleteRowCallback = vi.fn();
    const { getAllByTestId } = render(
      <TranscriptLine {...defaultProps} deleteRowCallback={deleteRowCallback} />,
    );
    const textarea = getAllByTestId('textarea')[0] as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'selectionStart', { value: 0, configurable: true });
    Object.defineProperty(textarea, 'selectionEnd', { value: 0, configurable: true });
    fireEvent.keyDown(textarea, { key: 'Backspace' });
    expect(deleteRowCallback).toHaveBeenCalledWith(0);
  });

  test('Backspace at non-zero position does not call deleteRowCallback', () => {
    const deleteRowCallback = vi.fn();
    const { getAllByTestId } = render(
      <TranscriptLine {...defaultProps} deleteRowCallback={deleteRowCallback} />,
    );
    const textarea = getAllByTestId('textarea')[0] as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'selectionStart', { value: 3, configurable: true });
    Object.defineProperty(textarea, 'selectionEnd', { value: 3, configurable: true });
    fireEvent.keyDown(textarea, { key: 'Backspace' });
    expect(deleteRowCallback).not.toHaveBeenCalled();
  });

  test('focus on text area calls onClickLine', () => {
    const onClickLine = vi.fn();
    const { getAllByTestId } = render(
      <TranscriptLine {...defaultProps} onClickLine={onClickLine} />,
    );
    fireEvent.focus(getAllByTestId('textarea')[0]);
    expect(onClickLine).toHaveBeenCalledWith(0);
  });

  test('onChange calls onTextChange', () => {
    const onTextChange = vi.fn();
    const { getAllByTestId } = render(
      <TranscriptLine {...defaultProps} onTextChange={onTextChange} />,
    );
    fireEvent.change(getAllByTestId('textarea')[0], { target: { value: 'New text' } });
    expect(onTextChange).toHaveBeenCalledWith(0, 'New text');
  });
});
