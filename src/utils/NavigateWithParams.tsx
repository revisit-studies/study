import { Navigate, NavigateProps, useSearchParams } from 'react-router';
import { useStartupInteractionBlocked } from '../components/StartupContext';

export function NavigateWithParams(
  props: Omit<NavigateProps, 'to'> & { to: string },
) {
  const [url] = useSearchParams();
  const startupInteractionBlocked = useStartupInteractionBlocked();

  if (startupInteractionBlocked) {
    return null;
  }

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
