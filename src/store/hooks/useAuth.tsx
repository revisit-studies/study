import {
  createContext, useContext, useMemo, useState, ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

export interface User {
  name?: string|null;
  email: string|null;
  admin: boolean;
}

interface AuthContextValue {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  }

const AuthContext = createContext<AuthContextValue>({
  user: null,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  login: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children } : { children: ReactNode }) {
  const [user, setUser] = useState<User|null>(null);
  const navigate = useNavigate();

  const login = async (currUser: User) => {
    setUser(currUser);
    navigate('/');
  };

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
