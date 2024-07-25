import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageTitle({ title }: { title: string }) {
  const location = useLocation();

  useEffect(() => {
    document.title = title;
  }, [location, title]);

  return null;
}
