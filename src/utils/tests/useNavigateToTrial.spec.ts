import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import { useNavigateToTrial } from '../useNavigateToTrial';

vi.mock('../Prefix', () => ({ PREFIX: '/base/' }));
vi.mock('../encryptDecryptIndex', () => ({
  encryptIndex: vi.fn((n: number) => `e${n}`),
}));

afterEach(() => vi.restoreAllMocks());

describe('useNavigateToTrial', () => {
  test('opens a new tab with the assembled study URL', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { result } = renderHook(() => useNavigateToTrial());

    result.current('0_1_2', 'pid-abc', 'my-study');

    const [url, target] = openSpy.mock.calls[0];
    expect(target).toBe('_blank');
    expect(url).toBe('/base/my-study/e0/e1/e2?participantId=pid-abc');
  });

  test('appends condition to search params when provided', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { result } = renderHook(() => useNavigateToTrial());

    result.current('0_1', 'pid-xyz', 'study-b', 'group-a');

    const [url] = openSpy.mock.calls[0];
    const parsed = new URL(url as string, 'http://localhost');
    expect(parsed.searchParams.get('condition')).toBe('group-a');
    expect(parsed.searchParams.get('participantId')).toBe('pid-xyz');
  });

  test('omits condition param when not provided', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { result } = renderHook(() => useNavigateToTrial());

    result.current('0', 'pid-1', 'study-c');

    const [url] = openSpy.mock.calls[0];
    expect(url as string).not.toContain('condition=');
  });
});
