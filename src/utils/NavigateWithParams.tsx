import { Navigate, NavigateProps, useSearchParams } from 'react-router';

export function NavigateWithParams(
  props: Omit<NavigateProps, 'to'> & { to: string },
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
