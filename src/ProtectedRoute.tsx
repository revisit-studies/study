import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './store/hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = useAuth();

  if (user && user.admin) {
    return <div>{children}</div>;
  }
  return <Navigate to="/login" />;
}
