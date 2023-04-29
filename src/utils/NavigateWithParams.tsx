import { Navigate, NavigateProps, useSearchParams } from 'react-router-dom';
import { PID, SESSION_ID } from '../store';

export function NavigateWithParams(
  props: Omit<NavigateProps, 'to'> & { to: string }
) {
  const [url] = useSearchParams();

  return (
    <Navigate
      {...{
        ...props,
        to: {
          pathname: props.to,
          search: url.toString(),
        },
      }}
    />
  );
}
