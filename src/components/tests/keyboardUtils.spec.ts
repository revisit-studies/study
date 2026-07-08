import { describe, expect, test } from 'vitest';
import { shouldIgnoreEnter } from '../keyboardUtils';

function elementFromHtml(html: string, selector: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.querySelector(selector)!;
}

describe('shouldIgnoreEnter', () => {
  test('ignores Enter inside a textarea', () => {
    expect(shouldIgnoreEnter(document.createElement('textarea'))).toBe(true);
  });

  test('ignores Enter inside a contenteditable element', () => {
    const div = elementFromHtml('<div contenteditable="true"></div>', 'div');
    expect(shouldIgnoreEnter(div)).toBe(true);
  });

  test('ignores Enter on a focused button (synthesized click handles it)', () => {
    expect(shouldIgnoreEnter(document.createElement('button'))).toBe(true);
  });

  test('ignores Enter on an element nested inside a button', () => {
    const span = elementFromHtml('<button><span>label</span></button>', 'span');
    expect(shouldIgnoreEnter(span)).toBe(true);
  });

  test('ignores Enter on a link', () => {
    expect(shouldIgnoreEnter(document.createElement('a'))).toBe(true);
  });

  test('does not ignore Enter on a button-styled radio card', () => {
    const card = elementFromHtml('<button role="radio">option</button>', 'button');
    expect(shouldIgnoreEnter(card)).toBe(false);
  });

  test('does not ignore Enter on an element nested inside a button-styled radio card', () => {
    const label = elementFromHtml('<button role="radio"><span>option</span></button>', 'span');
    expect(shouldIgnoreEnter(label)).toBe(false);
  });

  test('does not ignore Enter on a native radio input', () => {
    const radio = elementFromHtml('<input type="radio" />', 'input');
    expect(shouldIgnoreEnter(radio)).toBe(false);
  });

  test('does not ignore Enter on a single-line text input (Enter should still submit)', () => {
    const input = elementFromHtml('<input type="text" />', 'input');
    expect(shouldIgnoreEnter(input)).toBe(false);
  });

  test('does not ignore Enter on the document body', () => {
    expect(shouldIgnoreEnter(document.body)).toBe(false);
  });

  test('does not ignore Enter on a non-element target', () => {
    expect(shouldIgnoreEnter(null)).toBe(false);
    expect(shouldIgnoreEnter(window)).toBe(false);
  });
});
