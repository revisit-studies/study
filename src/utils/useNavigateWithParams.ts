import {
  NavigateOptions,
  To,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

export function useNavigateWithParams(): (
  to: To,
  options?: NavigateOptions
) => void {
  const navigate = useNavigate();
  const [url] = useSearchParams();

  return (to, opts) => {
    navigate(
      {
        pathname: to.toString(),
        search: url.toString(),
      },
      opts
    );
  };
}
