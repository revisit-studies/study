import {
  createContext, useContext, useMemo, ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from './useLocalStorage';

// Define User interface
export interface User {
  name?: string|null;
  email: string|null;
  isAdmin: boolean;
}

// Defines default AuthContextValue
interface AuthContextValue {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  }

// Initializes AuthContext
const AuthContext = createContext<AuthContextValue>({
  user: null,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  login: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

// Defines the functions that are exposed in this hook.
export function AuthProvider({ children } : { children: ReactNode }) {
  const [user, setUser] = useLocalStorage('user', null);
  const navigate = useNavigate();

  // Logs in the user (i.e. sets the user info and navigates to the root)
  const login = async (currUser: User) => {
    setUser(currUser);
    navigate('/');
  };

  // Logs the user out by removing the user and navigating to '/login'
  const logout = () => {
    setUser(null);
    navigate('/login');
  };

  const value = useMemo(() => ({
    user,
    login,
    logout,
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
