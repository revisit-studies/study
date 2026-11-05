import { describe, expect, test } from 'vitest';
import { getComponentContainerStyle } from '../componentStyle';

describe('getComponentContainerStyle', () => {
  test('keeps configured padding inside the styled stimulus', () => {
    const style = getComponentContainerStyle('image', { padding: '0 12px', backgroundColor: 'white', border: '1px solid black' });

    expect(style.padding).toBe('0 12px');
    expect(style.backgroundColor).toBe('white');
    expect(style.border).toBe('1px solid black');
  });

  test('adds maxWidth clamp when width is provided without maxWidth', () => {
    const style = getComponentContainerStyle('image', { width: '800px' });

    expect(style.width).toBe('800px');
    expect(style.maxWidth).toBe('100%');
  });

  test('does not override configured maxWidth', () => {
    const style = getComponentContainerStyle('image', { width: '800px', maxWidth: '700px' });

    expect(style.width).toBe('800px');
    expect(style.maxWidth).toBe('700px');
  });

  test('keeps default full width when no style width is configured', () => {
    const style = getComponentContainerStyle('image');

    expect(style.width).toBe('100%');
    expect(style.maxWidth).toBeUndefined();
  });
});
