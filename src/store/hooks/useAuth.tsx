import {
  createContext, useContext, useMemo, ReactNode,
  useEffect, useState,
} from 'react';
import {
  getAuth, onAuthStateChanged, User, signOut, Auth,
} from 'firebase/auth';
import { LoadingOverlay } from '@mantine/core';
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
  login: (user: UserWrapped) => Promise<void>;
  logout: () => Promise<void>;
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
  login: () => {},
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

  const [adminVerification, setAdminVerification] = useState<boolean>(false);

  const { storageEngine } = useStorageEngine();

  // Logs in the user (i.e. sets the user info and navigates to the root)
  const login = (inputUser: UserWrapped) => {
    setUser(inputUser);
  };

  // Logs the user out by removing the user and navigating to '/login'
  const logout = () => {
    setUser({
      user: null,
      determiningStatus: true,
      isAdmin: true,
    });
    setAdminVerification(false);
    const auth = getAuth();
    signOut(auth).then(() => {
      setUser({
        user: null,
        determiningStatus: false,
        isAdmin: false,
      });
    }).catch((error) => {
      setUser({
        user: null,
        determiningStatus: false,
        isAdmin: false,
      });
      console.error(`There was an issue signing-out the user: ${error.message}`);
    });
  };

  function isFirebaseUser(input: verifyAdminStatusInput): input is User {
    return input !== null && typeof input === 'object' && 'uid' in input;
  }

  function isLocalStorageUser(input: verifyAdminStatusInput): input is LocalStorageUser {
    return input !== null && typeof input === 'object' && !('uid' in input);
  }

  const verifyAdminStatus = async (inputUser: verifyAdminStatusInput) => {
    if (inputUser === null) {
      return Promise.resolve(true);
    } if (isFirebaseUser(inputUser)) {
      // Assert that the inputted user is the User type
      const firebaseUser = inputUser as User;
      if (storageEngine instanceof FirebaseStorageEngine) {
        const authInfo = await storageEngine?.getUserManagementData('authentication');
        const isAuthEnable = authInfo?.isEnabled;
        if (isAuthEnabled !== false) {
          // Validate the user if Auth enabled
          return await storageEngine.validateUserAdminStatus(firebaseUser, globalConfig.adminUsers);
        }
        // If authDisabled, allow access
        return Promise.resolve(true);
      }
      // If the user is Firebase but the storageEngine is not, something has gone wrong. Deny access
      return Promise.resolve(false);
    } if (isLocalStorageUser(inputUser)) {
      if (storageEngine) {
        // If storageEngine defined, allow access
        return Promise.resolve(true);
      }
      // If localStorageUser but no storageEngine defined, deny access.
      return Promise.resolve(false);
    }
    // Some other forms of the user input should be denied access.
    return Promise.resolve(false);
  };

  useEffect(() => {
    // Set initialUser
    setUser({
      user: null,
      isAdmin: false,
      determiningStatus: true,
    });

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
      setUser({
        user: null,
        isAdmin: false,
        determiningStatus: true,
      });
      if (firebaseUser) {
        // Reach out to firebase to validate user
        const isAdmin = await verifyAdminStatus(firebaseUser);
        setAdminVerification(true);
        login({
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
        const isAuthEnable = authInfo?.isEnabled;
        if (isAuthEnabled) {
          // Define unsubscribe function for listening to authentication state changes when using Firebase with authentication
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => await handleAuthStateChanged(firebaseUser));
          return () => unsubscribe();
        }
        login({
          user: {
            name: 'fakeName',
            email: 'fakeEmail@fake.com',
          },
          determiningStatus: false,
          isAdmin: true,
        });
      } else if (storageEngine) {
        login({
          user: {
            name: 'fakeName',
            email: 'fakeEmail@fake.com',
          },
          determiningStatus: false,
          isAdmin: true,
        });
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
    login,
    logout,
    verifyAdminStatus,
  }), [user]);

  return (
    <AuthContext.Provider value={value}>
      {user.determiningStatus ? <LoadingOverlay visible={user.determiningStatus} opacity={1} /> : children }
    </AuthContext.Provider>
  );
}
