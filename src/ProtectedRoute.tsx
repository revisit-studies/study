import { Alert, Button, LoadingOverlay } from '@mantine/core';
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { useAuth } from './store/hooks/useAuth';
import { useStorageEngine } from './storage/storageEngineHooks';

interface ProtectedRouteProps {
  children: ReactNode;
  paramToCheck?: string;
  paramCallback?: (paramToCheck:string) => Promise<boolean>;
  allowSupabaseSetup?: boolean;
}

// Wrapper component which only allows users who are authenticated and admins to access its child components.
export function ProtectedRoute({
  children, paramToCheck, paramCallback, allowSupabaseSetup = false,
}: ProtectedRouteProps) {
  const {
    user, verifyAdminStatus, logout, supabaseAuthStatus, triggerAuth,
  } = useAuth();
  const { storageEngine, configuredStorageEngine } = useStorageEngine();
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [supabaseAccess, setSupabaseAccess] = useState<{
    route: string; status: 'public' | 'protected' | 'error';
  } | null>(null);
  const [adminCheck, setAdminCheck] = useState<{
    key: string; result: boolean | 'error';
  } | null>(null);
  const [routeRetry, setRouteRetry] = useState(0);
  const params = useParams();
  const isSupabase = (configuredStorageEngine ?? storageEngine)?.getEngine() === 'supabase';
  const studyParam = paramToCheck ? params[paramToCheck] : undefined;
  const route = `${studyParam ?? ''}:${params.analysisTab ?? ''}:${routeRetry}`;
  const access = supabaseAccess?.route === route ? supabaseAccess.status : 'checking';
  const adminCheckKey = `${route}:${user.user?.uid ?? ''}:${supabaseAuthStatus}`;
  const verifiedAdmin = adminCheck?.key === adminCheckKey ? adminCheck.result : null;

  useEffect(() => {
    if (!isSupabase) return undefined;
    if (!paramCallback || !studyParam || params.analysisTab === 'manage' || params.analysisTab === 'storage') {
      setSupabaseAccess({ route, status: 'protected' });
      return undefined;
    }
    let cancelled = false;
    paramCallback(studyParam)
      .then((protectedRoute) => { if (!cancelled) setSupabaseAccess({ route, status: protectedRoute ? 'protected' : 'public' }); })
      .catch(() => { if (!cancelled) setSupabaseAccess({ route, status: 'error' }); });
    return () => { cancelled = true; };
  }, [isSupabase, paramCallback, studyParam, params.analysisTab, route]);

  useEffect(() => {
    if (!isSupabase || access !== 'protected' || !user.isAdmin
      || (supabaseAuthStatus !== 'enabled' && supabaseAuthStatus !== 'disabled')) {
      setAdminCheck(null);
      return undefined;
    }
    let cancelled = false;
    setAdminCheck(null);
    verifyAdminStatus(user)
      .then((isAdmin) => { if (!cancelled) setAdminCheck({ key: adminCheckKey, result: isAdmin }); })
      .catch(() => { if (!cancelled) setAdminCheck({ key: adminCheckKey, result: 'error' }); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupabase, access, user.isAdmin, supabaseAuthStatus, adminCheckKey]);

  useEffect(() => {
    if (isSupabase) return;
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
  }, [user.isAdmin, isEnabled, isSupabase]);

  if (isSupabase) {
    if (access === 'checking') return <LoadingOverlay visible />;
    if (access === 'error') {
      return (
        <Alert title="Unable to check study access" color="red">
          <span>Check your connection and </span>
          <Button onClick={() => setRouteRetry((value) => value + 1)}>Retry</Button>
        </Alert>
      );
    }
    // eslint-disable-next-line react/jsx-no-useless-fragment
    if (access === 'public') return <>{children}</>;
    if (supabaseAuthStatus === 'loading' || user.determiningStatus) return <LoadingOverlay visible />;
    if (supabaseAuthStatus === 'error') {
      return (
        <Alert title="Unable to check administrator access" color="red">
          <span>Check your connection and </span>
          <Button onClick={triggerAuth}>Retry</Button>
        </Alert>
      );
    }
    if (supabaseAuthStatus === 'unconfigured') {
      // eslint-disable-next-line react/jsx-no-useless-fragment
      return allowSupabaseSetup ? <>{children}</> : <Navigate to="/settings" />;
    }
    if (verifiedAdmin === 'error') {
      return (
        <Alert title="Unable to verify administrator access" color="red">
          <span>Check your connection and </span>
          <Button onClick={triggerAuth}>Retry</Button>
        </Alert>
      );
    }
    if (!user.isAdmin || verifiedAdmin === false) return <Navigate to="/login" />;
    if (verifiedAdmin === null) return <LoadingOverlay visible />;
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  if (user.determiningStatus || !storageEngine) {
    return <LoadingOverlay visible={user.determiningStatus || !storageEngine?.getEngine()} />;
  }

  if (isEnabled && !user.isAdmin && !user.determiningStatus) {
    return <Navigate to="/login" />;
  }
  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{children}</>;
}
