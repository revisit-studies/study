import { LoadingOverlay } from '@mantine/core';
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
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
      // If isEnabled is false, re-check. Additional rechecking is required becasue this effect needs to trigger whenever there is manipulation from an unwanted user.
      if (isEnabled === false) {
        // If we paramToCheck and paramCallback (meaning checking enabling the protected route is necessary), check
        if (paramToCheck && paramCallback && params[paramToCheck]) {
          // Get the current enabling feature
          const currIsEnabled = await paramCallback(params[paramToCheck]!);
          // If it should be enabled, set to true. Otherwise, leave as false.
          if (currIsEnabled) {
            setIsEnabled(currIsEnabled);
          }
        // Otherwise, isEnabled was set to false by external user state manipulation
        } else {
          setIsEnabled(true);
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
