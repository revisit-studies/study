/* eslint-disable @typescript-eslint/no-explicit-any */
// Took this whole thing from https://github.com/datavisyn/visyn_core/blob/develop/src/hooks/useAsync.tsx
import {
  useState, useRef, useEffect, useCallback,
} from 'react';
import useDeepCompareEffect from 'use-deep-compare-effect';

// https://stackoverflow.com/questions/48011353/how-to-unwrap-type-of-a-promise
type Awaited<T> = T extends PromiseLike<infer U> ? { 0: Awaited<U>; 1: U }[U extends PromiseLike<any> ? 0 : 1] : T;

export type useAsyncStatus = 'idle' | 'pending' | 'success' | 'error';

/**
 * Wraps an (async) function and provides value, status and error states.
 *
 * Compares the `immediate` array using [use-deep-compare-effect](https://github.com/kentcdodds/use-deep-compare-effect) such that it does not have to be memoized.
 *
 * **Usage:**
 * ```typescript
 * // Somewhere outside
 * async function fetchData(id: number): Promise<string> {
 *   return fetch(...);
 * }
 *
 * // In the component
 * ...
 * const {status, error, execute: wrappedFetchData} = useAsync(fetchData);
 * // Or with single, but immediate execution
 * const {status, error, execute: wrappedFetchData} = useAsync(fetchData, [123]);
 * ...
 * wrappedFetchData(123)
 * ```
 *
 * @param asyncFunction Async function to be wrapped.
 * @param immediate Null if function should not be triggered immediately, or the initial parameter array if immediate.
 */
export const useAsync = <F extends (...args: any[]) => any, E = Error, T = Awaited<ReturnType<F>>>(
  asyncFunction: F,
  immediate: Parameters<F> | null = null,
) => {
  const [status, setStatus] = useState<useAsyncStatus>('idle');
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);
  const latestPromiseRef = useRef<Promise<T> | null>(null);
  const mountedRef = useRef<boolean>(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // The execute function wraps asyncFunction and
  // handles setting state for pending, value, and error.
  // useCallback ensures the below useEffect is not called
  // on every render, but only if asyncFunction changes.
  const execute = useCallback(
    (...args: Parameters<typeof asyncFunction>) => {
      setStatus('pending');
      // Do not unset the value, as we mostly want to retain the last value to avoid flickering, i.e. for "silent" updates.
      // setValue(null);
      setError(null);
      const currentPromise = Promise.resolve(asyncFunction(...args))
        .then((response: T) => {
          if (mountedRef.current && currentPromise === latestPromiseRef.current) {
            setValue(response);
            setStatus('success');
          }
          return response;
        })
        .catch((e: E) => {
          if (mountedRef.current && currentPromise === latestPromiseRef.current) {
            setValue(null);
            setError(e);
            setStatus('error');
          }
          throw e;
        });
      latestPromiseRef.current = currentPromise;
      return currentPromise;
    },
    [asyncFunction],
  );
  // Call execute if we want to fire it right away.
  // Otherwise execute can be called later, such as
  // in an onClick handler.
  useDeepCompareEffect(() => {
    if (immediate) {
      try {
        execute(...immediate);
      } catch {
        // ignore any immediate error
      }
    }
  }, [execute, immediate]);

  return {
    execute, status, value, error,
  };
};
