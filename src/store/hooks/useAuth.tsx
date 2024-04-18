import {
  createContext, useContext, useMemo, ReactNode,
  useEffect, useState,
} from 'react';
import {
  getAuth, onAuthStateChanged, User, signOut, Auth,
} from 'firebase/auth';
import { LoadingOverlay } from '@mantine/core';
import { flattenDiagnosticMessageText } from 'typescript';
import { useStorageEngine } from '../storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { GlobalConfig } from '../../parser/types';

interface LocalStorageUser {
  name: string,
  email: string
}

type UserOptions = User | LocalStorageUser | null;

interface UserWrapped {
  user: UserOptions,
  determiningStatus: boolean,
  isAdmin: boolean
}

// Defines default AuthContextValue
interface AuthContextValue {
  user: UserWrapped;
  adminVerification: boolean;
  logout: () => void;
  verifyAdminStatus: (firebaseUser: UserOptions) => Promise<boolean>;
  }

// Initializes AuthContext
const AuthContext = createContext<AuthContextValue>({
  user: {
    user: null,
    determiningStatus: false,
    isAdmin: false,
  },
  adminVerification: false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  logout: () => {},
  verifyAdminStatus: () => Promise.resolve(false),

});

// Firebase auth context
export const useAuth = () => useContext(AuthContext);

// Defines the functions that are exposed in this hook.
export function AuthProvider({ children, globalConfig } : { children: ReactNode, globalConfig: GlobalConfig }) {
  const [user, setUser] = useState<UserWrapped>(
    {
      user: null,
      determiningStatus: true,
      isAdmin: false,
    },
  );

  // Default non-user when loading
  const loadingNullUser : UserWrapped = {
    user: null,
    determiningStatus: true,
    isAdmin: false,
  };

  // Default non-user when not loading
  const nonLoadingNullUser : UserWrapped = {
    user: null,
    determiningStatus: false,
    isAdmin: false,
  };

  // Non-auth User
  const nonAuthUser : UserWrapped = {
    user: {
      name: 'fakeName',
      email: 'fakeEmail@fake.com',
    },
    determiningStatus: false,
    isAdmin: true,
  };

  const [adminVerification, setAdminVerification] = useState<boolean>(false);

  const { storageEngine } = useStorageEngine();

  // Logs the user out by removing the user and navigating to '/login'
  const logout = async () => {
    setUser(loadingNullUser);
    setAdminVerification(false);
    const auth = getAuth();
    try {
      await signOut(auth);
    } catch (error) {
      let message = 'Unknown error';
      if (error instanceof Error) {
        ({ message } = error);
      }
      console.error(`There was an issue signing-out the user: ${message}`);
    }
    setUser(nonLoadingNullUser);
  };

  function isFirebaseUser(input: UserOptions): input is User {
    return input !== null && typeof input === 'object' && 'uid' in input;
  }

  function isLocalStorageUser(input: UserOptions): input is LocalStorageUser {
    return input !== null && typeof input === 'object' && !('uid' in input);
  }

  const verifyAdminStatus = async (inputUser: UserOptions) => {
    if (inputUser === null) {
      return true;
    } if (isFirebaseUser(inputUser)) {
      // Assert that the inputted user is the User type
      const firebaseUser = inputUser;
      if (storageEngine instanceof FirebaseStorageEngine) {
        const authInfo = await storageEngine?.getUserManagementData('authentication');
        const isAuthEnabled = authInfo?.isEnabled;
        if (isAuthEnabled !== false) {
          // Validate the user if Auth enabled
          return await storageEngine.validateUserAdminStatus(firebaseUser, globalConfig.adminUsers);
        }
        // If authDisabled, allow access
        return true;
      }
      // If the user is Firebase but the storageEngine is not, something has gone wrong. Deny access
      return false;
    } if (isLocalStorageUser(inputUser)) {
      if (storageEngine) {
        // If storageEngine defined, allow access
        return true;
      }
      // If localStorageUser but no storageEngine defined, deny access.
      return false;
    }
    // Some other forms of the user input should be denied access.
    return false;
  };

  useEffect(() => {
    // Set initialUser
    setUser(loadingNullUser);

    // Get authentication
    let auth: Auth;
    try {
      auth = getAuth();
    } catch (error) {
      console.warn('No firebase store.');
    }

    // Handle auth state changes for Firebase
    const handleAuthStateChanged = async (firebaseUser: User | null) => {
      // Reset the user
      setUser((prevUser) => ({
        user: prevUser.user,
        isAdmin: prevUser.isAdmin,
        determiningStatus: true,
      }));
      if (firebaseUser) {
        // Reach out to firebase to validate user
        const isAdmin = await verifyAdminStatus(firebaseUser);
        setAdminVerification(true);
        setUser({
          user: firebaseUser,
          determiningStatus: false,
          isAdmin,
        });
      } else {
        logout();
      }
    };

    // Determine authentication listener based on storageEngine and authEnabled variable
    const determineAuthentication = async () => {
      if (storageEngine instanceof FirebaseStorageEngine) {
        const authInfo = await storageEngine?.getUserManagementData('authentication');
        const isAuthEnabled = authInfo?.isEnabled;
        if (isAuthEnabled) {
          // Define unsubscribe function for listening to authentication state changes when using Firebase with authentication
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => await handleAuthStateChanged(firebaseUser));
          return () => unsubscribe();
        }
        setUser(nonAuthUser);
      } else if (storageEngine) {
        setUser(nonAuthUser);
      }
      return () => {};
    };

    const cleanupPromise = determineAuthentication();

    return () => {
      cleanupPromise.then((cleanup) => cleanup());
    };
  }, [storageEngine]);

  const value = useMemo(() => ({
    user,
    adminVerification,
    logout,
    verifyAdminStatus,
  }), [user]);

  return (
    <AuthContext.Provider value={value}>
      {user.determiningStatus ? <LoadingOverlay visible={user.determiningStatus} opacity={1} /> : children }
    </AuthContext.Provider>
  );
}
