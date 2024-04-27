import { LoadingOverlay } from '@mantine/core';
import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './store/hooks/useAuth';
import { useStorageEngine } from './storage/storageEngineHooks';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Wrapper component which only allows users who are authenticated and admins to access its child components.
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, verifyAdminStatus, logout } = useAuth();
  const { storageEngine } = useStorageEngine();

  useEffect(() => {
    const verifyUser = async () => {
      try {
        if (user) {
          const isAdmin = await verifyAdminStatus(user);
          if (!isAdmin) {
            logout();
          }
        } else {
          logout();
        }
      } catch (error) {
        logout();
        console.warn(error);
      }
    };
    verifyUser();
  }, [user.isAdmin]);

  if (user.determiningStatus || !storageEngine) {
    return <LoadingOverlay visible={user.determiningStatus || !storageEngine?.getEngine()} />;
  }

  if (!user.isAdmin && !user.determiningStatus) {
    return <Navigate to="/login" />;
  }
  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{children}</>;
}
