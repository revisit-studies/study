import { LoadingOverlay } from '@mantine/core';
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './store/hooks/useAuth';
import { useStorageEngine } from './store/storageEngineHooks';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Wrapper component which only allows users who are authenticated and admins to access its child components.
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = useAuth();
  const { storageEngine } = useStorageEngine();

  if (user.determiningStatus || !storageEngine) {
    return <LoadingOverlay overlayOpacity={0} visible={user.determiningStatus || !storageEngine?.getEngine()} />;
  }

  if (!user.isAdmin && !user.determiningStatus) {
    return <Navigate to="/login" />;
  }
  return <div>{children}</div>;
}
