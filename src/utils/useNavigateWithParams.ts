import {
  NavigateOptions,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

export function useNavigateWithParams(): (
  to: string,
  options?: NavigateOptions
) => void {
  const navigate = useNavigate();
  const [url] = useSearchParams();

  return (to, opts) => {
    navigate(
      {
        pathname: to,
        search: url.toString(),
      },
      opts
    );
  };
}
