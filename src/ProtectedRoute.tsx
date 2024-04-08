import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, User } from './store/hooks/useAuth';
import { useStorageEngine } from './store/storageEngineHooks';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, login } = useAuth();
  const { storageEngine } = useStorageEngine();

  useEffect(() => {
    if (storageEngine?.getEngine() !== 'firebase') {
      // If not using firebase as storage engine, authenticate the user with a fake user with admin privileges.
      const currUser: User = {
        name: 'localName',
        admin: true,
        email: 'localEmail@example.com',
      };
      login(currUser);
    }
  }, []);

  if (user && user.admin) {
    return <div>{children}</div>;
  }
  return <Navigate to="/login" />;
}
