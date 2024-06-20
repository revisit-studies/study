import { LoadingOverlay } from '@mantine/core';
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from './store/hooks/useAuth';
import { useStorageEngine } from './storage/storageEngineHooks';

interface ProtectedRouteProps {
  children: ReactNode;
  paramToCheck?: string;
  paramCallback?: (paramToCheck:string) => Promise<boolean>;
}

// Wrapper component which only allows users who are authenticated and admins to access its child components.
export function ProtectedRoute({ children, paramToCheck, paramCallback }: ProtectedRouteProps) {
  const { user, verifyAdminStatus, logout } = useAuth();
  const { storageEngine } = useStorageEngine();
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const params = useParams();

  useEffect(() => {
    const verifyUser = async () => {
      if (paramToCheck && paramCallback && params[paramToCheck] && isEnabled === false) {
        const currIsEnabled = await paramCallback(params[paramToCheck]!);
        setIsEnabled(currIsEnabled);
      }
      if (isEnabled) {
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
      }
    };

    verifyUser();
  }, [user.isAdmin, isEnabled]);

  if (user.determiningStatus || !storageEngine) {
    return <LoadingOverlay visible={user.determiningStatus || !storageEngine?.getEngine()} />;
  }

  if (isEnabled && !user.isAdmin && !user.determiningStatus) {
    return <Navigate to="/login" />;
  }
  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{children}</>;
}
