import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { useFetchStylesheet } from '../fetchStylesheet';

vi.mock('../Prefix', () => ({ PREFIX: '/prefix/' }));

afterEach(() => {
  document.head.querySelectorAll('link[data-stylesheet-path]').forEach((el) => el.remove());
});

describe('useFetchStylesheet', () => {
  test('does nothing when stylesheetPath is undefined', () => {
    const before = document.head.querySelectorAll('link').length;
    renderHook(() => useFetchStylesheet(undefined));
    expect(document.head.querySelectorAll('link').length).toBe(before);
  });

  test('appends a link element with the prefixed href when path is provided', () => {
    renderHook(() => useFetchStylesheet('styles/theme.css'));
    const link = document.head.querySelector<HTMLLinkElement>('link[data-stylesheet-path="styles/theme.css"]');
    expect(link).toBeTruthy();
    expect(link?.rel).toBe('stylesheet');
    expect(link?.href).toContain('/prefix/styles/theme.css');
  });

  test('removes the link element when the hook unmounts', () => {
    const { unmount } = renderHook(() => useFetchStylesheet('styles/remove-me.css'));
    expect(document.head.querySelector('link[data-stylesheet-path="styles/remove-me.css"]')).toBeTruthy();
    unmount();
    expect(document.head.querySelector('link[data-stylesheet-path="styles/remove-me.css"]')).toBeNull();
  });

  test('updates the link href when the path changes', () => {
    const { rerender } = renderHook(({ path }: { path: string | undefined }) => useFetchStylesheet(path), {
      initialProps: { path: 'styles/v1.css' as string | undefined },
    });
    expect(document.head.querySelector('link[data-stylesheet-path="styles/v1.css"]')).toBeTruthy();

    rerender({ path: 'styles/v2.css' });
    expect(document.head.querySelector('link[data-stylesheet-path="styles/v1.css"]')).toBeNull();
    expect(document.head.querySelector('link[data-stylesheet-path="styles/v2.css"]')).toBeTruthy();
  });
});
