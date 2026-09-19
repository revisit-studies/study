import { describe, expect, test } from 'vitest';
import { getComponentContainerStyle } from '../componentStyle';

describe('getComponentContainerStyle', () => {
  test('does not duplicate page padding on the stimulus', () => {
    const style = getComponentContainerStyle('image', { padding: '0 12px', backgroundColor: 'white' });

    expect(style.padding).toBeUndefined();
    expect(style.backgroundColor).toBe('white');
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
