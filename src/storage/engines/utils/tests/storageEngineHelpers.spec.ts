import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import {
  isTransactionContentionError, isWebKitBrowser, retrySequenceAllocation, SEQUENCE_ALLOCATION_CONTENTION_RETRIES,
} from '../storageEngineHelpers';

describe('isWebKitBrowser', () => {
  test.each([
    ['desktop Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', true],
    ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', true],
    ['Chrome on iOS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1', true],
    ['Firefox on iOS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15', true],
    ['Edge on iOS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.0.2903.68 Mobile/15E148 Safari/605.1.15', true],
    ['desktop Chrome', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', false],
    ['desktop Edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0', false],
    ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', false],
    ['desktop Firefox', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0', false],
    ['no user agent', '', false],
  ])('%s', (_name, userAgent, expected) => {
    expect(isWebKitBrowser(userAgent)).toBe(expected);
  });
});

describe('retrySequenceAllocation', () => {
  const contention = Object.assign(new Error('Transaction failed'), { name: 'FirebaseError', code: 'aborted' });

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  test.each([
    [contention, true],
    [{ code: 'failed-precondition' }, true],
    [{ code: 'permission-denied' }, false],
    [new Error('aborted'), false],
    [null, false],
  ])('classifies %o as contention: %s', (error, expected) => {
    expect(isTransactionContentionError(error)).toBe(expected);
  });

  test('retries an allocation whose transaction lost to contention', async () => {
    const allocate = vi.fn()
      .mockRejectedValueOnce(contention)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('allocated');
    const result = retrySequenceAllocation(allocate);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe('allocated');
    expect(allocate).toHaveBeenCalledTimes(3);
  });

  test('reports contention once its retries are used up', async () => {
    const allocate = vi.fn().mockRejectedValue(contention);
    const result = retrySequenceAllocation(allocate);
    const assertion = expect(result).rejects.toBe(contention);
    await vi.runAllTimersAsync();
    await assertion;
    expect(allocate).toHaveBeenCalledTimes(SEQUENCE_ALLOCATION_CONTENTION_RETRIES + 1);
  });

  test('does not retry other errors', async () => {
    const failure = new Error('Latin square not initialized');
    const allocate = vi.fn().mockRejectedValue(failure);
    await expect(retrySequenceAllocation(allocate)).rejects.toBe(failure);
    expect(allocate).toHaveBeenCalledTimes(1);
  });
});
