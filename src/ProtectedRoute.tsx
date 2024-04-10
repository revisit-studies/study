import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './store/hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Wrapper component which only allows users who are authenticated and admins to access its child components.
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = useAuth();

  if (user && user.isAdmin) {
    return <div>{children}</div>;
  }
  return <Navigate to="/login" />;
}
