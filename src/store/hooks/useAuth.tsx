import {
  createContext, useContext, useMemo, ReactNode,
  useEffect, useState,
} from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { useStorageEngine } from '../storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { GlobalConfig } from '../../parser/types';
import { LocalStorageEngine } from '../../storage/engines/LocalStorageEngine';

interface LocalStorageUser{
  name: string,
  email: string
}

interface UserWrapped{
  user:User|LocalStorageUser|null,
  determiningStatus:boolean,
  isAdmin:boolean
}

// Defines default AuthContextValue
interface AuthContextValue {
  user: UserWrapped;
  login: (user: UserWrapped) => void;
  logout: () => void;
  }

// Initializes AuthContext
const AuthContext = createContext<AuthContextValue>({
  user: {
    user: null,
    determiningStatus: false,
    isAdmin: false,
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  login: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  logout: () => {},
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

  const { storageEngine } = useStorageEngine();

  // Logs in the user (i.e. sets the user info and navigates to the root)
  const login = async (inputUser: UserWrapped) => {
    setUser(inputUser);
  };

  // Logs the user out by removing the user and navigating to '/login'
  const logout = () => {
    setUser({
      user: null,
      determiningStatus: false,
      isAdmin: false,
    });
  };

  useEffect(() => {
    setUser({
      user: null,
      isAdmin: false,
      determiningStatus: true,
    });
    if (storageEngine instanceof FirebaseStorageEngine) {
      const auth = getAuth();
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser({
          user: null,
          isAdmin: false,
          determiningStatus: true,
        });
        if (firebaseUser) {
          // Reach out to firebase to validate user
          storageEngine.validateUserAdminStatus(firebaseUser, globalConfig.adminUsers)
            .then((isUserAdmin) => {
              if (!isUserAdmin) {
                logout();
              } else {
                const newFirebaseUser: UserWrapped = {
                  user: firebaseUser,
                  determiningStatus: false,
                  isAdmin: true,
                };
                login(newFirebaseUser);
              }
            });
        } else {
          logout();
        }
      });
      // Clean up subscription
      return () => unsubscribe();
    } if (storageEngine instanceof LocalStorageEngine) {
      const localStorageUser: LocalStorageUser = {
        name: 'fakeName',
        email: 'fakeEmail@fake.com',
      };
      const localStorageUserWrapped: UserWrapped = {
        user: localStorageUser,
        determiningStatus: false,
        isAdmin: true,
      };
      login(localStorageUserWrapped);
      // Clean-up
      return () => {};
    }
    // Clean-up
    return () => {};
  }, [storageEngine]);

  const value = useMemo(() => ({
    user,
    login,
    logout,
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
