import { LoadingOverlay } from '@mantine/core';
import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  User,
} from 'firebase/auth';
import { useAuth } from './store/hooks/useAuth';
import { useStorageEngine } from './store/storageEngineHooks';
import { FirebaseStorageEngine } from './storage/engines/FirebaseStorageEngine';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Wrapper component which only allows users who are authenticated and admins to access its child components.
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, verifyAdminStatus, logout } = useAuth();
  const { storageEngine } = useStorageEngine();

  if (user.determiningStatus || !storageEngine) {
    return <LoadingOverlay overlayOpacity={0} visible={user.determiningStatus || !storageEngine?.getEngine()} />;
  }

  useEffect(() => {
    const verifyUser = async () => {
      try {
        if (user) {
          const isAdmin = await verifyAdminStatus(user?.user);
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

  if (!user.isAdmin && !user.determiningStatus) {
    return <Navigate to="/login" />;
  }
  return <div>{children}</div>;
}
