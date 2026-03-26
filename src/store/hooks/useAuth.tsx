import {
  createContext, useContext, useMemo, ReactNode,
  useEffect, useState,
  useCallback,
} from 'react';
import { LoadingOverlay } from '@mantine/core';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StoredUser, UserWrapped } from '../../storage/engines/types';
import { isCloudStorageEngine } from '../../storage/engines/utils';
import { SupabaseStorageEngine } from '../../storage/engines/SupabaseStorageEngine';

// Defines default AuthContextValue
interface AuthContextValue {
  user: UserWrapped;
  logout: () => Promise<void>;
  triggerAuth: () => void;
  verifyAdminStatus: (inputUser: UserWrapped) => Promise<boolean>;
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
  const [enableAuthTrigger, setEnableAuthTrigger] = useState(false);
  const { storageEngine } = useStorageEngine();

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
    setEnableAuthTrigger(true);
  }, []);

  // This useEffect checks for an existing Supabase session on mount since it requires a redirect to login
  useEffect(() => {
    const checkSession = async () => {
      if (storageEngine?.getEngine() === 'supabase') {
        try {
          console.warn('[ReVISit][Auth] Checking existing Supabase session');
          await (storageEngine as SupabaseStorageEngine).getSession();
          console.warn('[ReVISit][Auth] Supabase session check completed');
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
    console.warn('[ReVISit][Auth] Auth effect starting', {
      storageEngine: storageEngine?.getEngine?.() ?? null,
      enableAuthTrigger,
    });
    setUser(loadingNullUser);

    // Handle auth state changes for Firebase
    const handleAuthStateChanged = async (cloudUser: StoredUser | null) => {
      console.warn('[ReVISit][Auth] Auth state changed', {
        hasCloudUser: Boolean(cloudUser),
        email: cloudUser?.email || null,
        uidPresent: Boolean(cloudUser?.uid),
      });
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
        console.warn('[ReVISit][Auth] Validating admin status for signed-in user', {
          email: cloudUser.email,
        });
        const isAdmin = await verifyAdminStatus(currUser);
        currUser.isAdmin = !!isAdmin;
        console.warn('[ReVISit][Auth] Admin validation complete', {
          email: cloudUser.email,
          isAdmin: currUser.isAdmin,
        });
        setUser(currUser);
      } else {
        console.warn('[ReVISit][Auth] No cloud user present, logging out');
        logout();
      }
    };

    // Determine authentication listener based on storageEngine and authEnabled variable
    const determineAuthentication = async () => {
      console.warn('[ReVISit][Auth] determineAuthentication() called', {
        hasStorageEngine: Boolean(storageEngine),
        storageEngine: storageEngine?.getEngine?.() ?? null,
      });
      if (storageEngine && isCloudStorageEngine(storageEngine)) {
        try {
          const authInfo = await storageEngine.getUserManagementData('authentication');
          console.warn('[ReVISit][Auth] authentication config fetched', {
            authEnabled: authInfo?.isEnabled,
          });
          if (authInfo?.isEnabled) {
            console.warn('[ReVISit][Auth] Auth is enabled, registering Firebase auth listener');
            const cleanup = storageEngine.unsubscribe(handleAuthStateChanged);
            return cleanup;
          }
          console.warn('[ReVISit][Auth] Auth is disabled, using non-auth user');
          setUser(nonAuthUser);
        } catch (error) {
          console.error('[ReVISit][Auth] Failed to determine authentication config', error);
          console.warn('[ReVISit][Auth] Defaulting to auth listener registration after failure');
          const cleanup = storageEngine.unsubscribe(handleAuthStateChanged);
          return cleanup;
        }
      } else if (storageEngine) {
        console.warn('[ReVISit][Auth] Non-cloud storage engine detected, using non-auth user');
        setUser(nonAuthUser);
      } else {
        console.warn('[ReVISit][Auth] No storage engine available yet');
      }
      return () => {};
    };

    const cleanupPromise = determineAuthentication();

    return () => {
      console.warn('[ReVISit][Auth] Cleaning up auth effect');
      cleanupPromise.then((cleanup) => cleanup());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageEngine, enableAuthTrigger]);

  const value = useMemo(() => ({
    user,
    triggerAuth,
    logout,
    verifyAdminStatus,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user]);

  return (
    <AuthContext.Provider value={value}>
      {user.determiningStatus ? <LoadingOverlay visible /> : children }
    </AuthContext.Provider>
  );
}
