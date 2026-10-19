import { useEffect, useState } from 'react';

export type AsyncResourceStatus = 'unresolved' | 'loading' | 'success' | 'missing' | 'error';

interface AsyncResourceState<T> {
  key?: string;
  status: AsyncResourceStatus;
  value?: T;
}

export function useAsyncResource<T>(
  requestKey: string | undefined,
  load: (key: string) => Promise<T | undefined>,
): AsyncResourceState<T> {
  const [state, setState] = useState<AsyncResourceState<T>>({
    key: requestKey,
    status: requestKey === undefined ? 'unresolved' : 'loading',
  });

  useEffect(() => {
    let cancelled = false;

    if (requestKey === undefined) {
      setState({ key: requestKey, status: 'unresolved' });
      return () => {
        cancelled = true;
      };
    }

    setState({ key: requestKey, status: 'loading' });
    Promise.resolve()
      .then(() => load(requestKey))
      .then((value) => {
        if (!cancelled) {
          setState({
            key: requestKey,
            status: value === undefined ? 'missing' : 'success',
            value,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ key: requestKey, status: 'error' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [load, requestKey]);

  if (state.key !== requestKey) {
    return {
      key: requestKey,
      status: requestKey === undefined ? 'unresolved' : 'loading',
    };
  }

  return state;
}
