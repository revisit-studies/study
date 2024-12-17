/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as React from 'react';

/**
 * Creates a callback that always has the latest version of the given handler.
 * Can be used to avoid stale closures in event handlers. See https://twitter.com/diegohaz/status/1522868292301606912?s=20 for details.
 *
 * Example:
 * ```tsx
 * const onClick = useEvent((e: MouseEvent) => {
 *  console.log(e);
 * });
 *
 * return <button onClick={onClick} />;
 * ```
 * @param handler Event handler to be wrapped.
 * @returns Callback that always has the latest version of the given handler.
 */
export function useEvent<T extends(...args: any[]) => any, P extends Parameters<T>>(handler: T) {
  // @ts-ignore
  const handlerRef = React.useRef<T>(() => {
    throw new Error('Cannot call an event handler while rendering.');
  });

  React.useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  // @ts-ignore
  return React.useCallback<T>((...args: P) => handlerRef.current?.(...args), []);
}
