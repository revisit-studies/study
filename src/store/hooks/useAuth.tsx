import {
  createContext, useContext, useMemo, ReactNode,
  useEffect, useState,
  useCallback,
} from 'react';
import { LoadingOverlay } from '@mantine/core';
import { useLocation, useMatch } from 'react-router';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StoredUser, UserWrapped } from '../../storage/engines/types';
import { isCloudStorageEngine } from '../../storage/engines/utils/storageEngineHelpers';
import { SupabaseStorageEngine } from '../../storage/engines/SupabaseStorageEngine';

type SupabaseAuthStatus = 'loading' | 'enabled' | 'disabled' | 'unconfigured' | 'error';

// Defines default AuthContextValue
interface AuthContextValue {
  user: UserWrapped;
  logout: () => Promise<void>;
  triggerAuth: () => void;
  verifyAdminStatus: (inputUser: UserWrapped) => Promise<boolean>;
  supabaseAuthStatus: SupabaseAuthStatus;
  }

// Initializes AuthContext
const AuthContext = createContext<AuthContextValue>({
  user: {
    user: null,
    determiningStatus: false,
    isAdmin: false,
    adminVerification: false,
  },
  logout: async () => {},
  triggerAuth: () => {},
  verifyAdminStatus: () => Promise.resolve(false),
  supabaseAuthStatus: 'loading',
});

// Firebase auth context
export const useAuth = () => useContext(AuthContext);

// Defines the functions that are exposed in this hook.
export function AuthProvider({ children } : { children: ReactNode }) {
  // Default non-user when loading
  const loadingNullUser : UserWrapped = {
    user: null,
    determiningStatus: true,
    isAdmin: false,
    adminVerification: false,
  };

  // Default non-user when not loading
  const nonLoadingNullUser : UserWrapped = {
    user: null,
    determiningStatus: false,
    isAdmin: false,
    adminVerification: false,
  };

  // Non-auth User
  const nonAuthUser : UserWrapped = {
    user: {
      email: 'fakeEmail@fake.com',
      uid: 'fakeUid',
    },
    determiningStatus: false,
    isAdmin: true,
    adminVerification: true,
  };

  const [user, setUser] = useState(loadingNullUser);
  const [enableAuthTrigger, setEnableAuthTrigger] = useState(0);
  const [supabaseAuthStatus, setSupabaseAuthStatus] = useState<SupabaseAuthStatus>('loading');
  const { storageEngine } = useStorageEngine();
  const location = useLocation();
  const studyRouteMatch = useMatch('/:studyId/*');

  // Logs the user out by removing the user and navigating to '/login'
  const logout = async () => {
    if (storageEngine && isCloudStorageEngine(storageEngine)) {
      try {
        await storageEngine.logout();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error(`There was an issue signing-out the user: ${error.message}`);
      } finally {
        setUser(nonLoadingNullUser);
      }
    }
  };

  const triggerAuth = useCallback(() => {
    setEnableAuthTrigger((value) => value + 1);
  }, []);

  // This useEffect checks for an existing Supabase session on mount since it requires a redirect to login
  useEffect(() => {
    const checkSession = async () => {
      if (storageEngine?.getEngine() === 'supabase') {
        try {
          await (storageEngine as SupabaseStorageEngine).getSession();
        } catch (err) {
          // optional: log or handle errors
          console.error('Supabase session check failed', err);
        }
      }
    };
    checkSession();
  }, [storageEngine, triggerAuth]);

  const verifyAdminStatus = async (inputUser: UserWrapped) => {
    if (storageEngine && isCloudStorageEngine(storageEngine)) {
      return await storageEngine.validateUser(inputUser, true);
    }
    return false;
  };

  useEffect(() => {
    // Set initialUser
    setUser(loadingNullUser);
    setSupabaseAuthStatus('loading');
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    // Handle auth state changes for Firebase
    const handleAuthStateChanged = async (cloudUser: StoredUser | null) => {
      if (cancelled) return;
      // Reset the user. This also gets called on signOut
      setUser((prevUser) => ({
        user: prevUser.user,
        isAdmin: prevUser.isAdmin,
        determiningStatus: true,
        adminVerification: false,
      }));
      if (cloudUser) {
        // Reach out to firebase to validate user
        const currUser: UserWrapped = {
          user: cloudUser,
          determiningStatus: false,
          isAdmin: false,
          adminVerification: true,
        };
        try {
          currUser.isAdmin = !!(await verifyAdminStatus(currUser));
          if (!cancelled) setUser(currUser);
        } catch {
          if (!cancelled) {
            setUser(nonLoadingNullUser);
            setSupabaseAuthStatus('error');
          }
        }
      } else if (!cancelled) setUser(nonLoadingNullUser);
    };

    // Determine authentication listener based on storageEngine and authEnabled variable
    const determineAuthentication = async () => {
      try {
        if (storageEngine && isCloudStorageEngine(storageEngine)) {
          const authInfo = await storageEngine.getUserManagementData('authentication');
          if (cancelled) return;
          if (authInfo?.isEnabled === true) {
            if (storageEngine.getEngine() === 'supabase') setSupabaseAuthStatus('enabled');
            unsubscribe = storageEngine.unsubscribe(handleAuthStateChanged);
          } else if (storageEngine.getEngine() === 'supabase' && authInfo?.isEnabled !== false) {
            setSupabaseAuthStatus('unconfigured');
            setUser(nonLoadingNullUser);
          } else {
            if (storageEngine.getEngine() === 'supabase') setSupabaseAuthStatus('disabled');
            setUser(nonAuthUser);
          }
        } else if (storageEngine) {
          setUser(nonAuthUser);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to determine authentication status:', error);
          setSupabaseAuthStatus('error');
          setUser(nonLoadingNullUser);
        }
      }
    };

    determineAuthentication();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageEngine, enableAuthTrigger]);

  const value = useMemo(() => ({
    user,
    triggerAuth,
    logout,
    verifyAdminStatus,
    supabaseAuthStatus,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, supabaseAuthStatus]);

  const allowChildrenWhileDeterminingStatus = storageEngine?.getEngine() === 'supabase'
    || (Boolean(studyRouteMatch) && !location.pathname.startsWith('/analysis'));

  return (
    <AuthContext.Provider value={value}>
      {user.determiningStatus && !allowChildrenWhileDeterminingStatus ? <LoadingOverlay visible /> : children }
    </AuthContext.Provider>
  );
}
