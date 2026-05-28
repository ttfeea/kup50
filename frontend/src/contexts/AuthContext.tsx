import {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react';
import { loginRequest } from '../api/auth';

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager';
};

type AuthContextValue = {
  user: MockUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const mockUser: MockUser = {
  id: 'u_001',
  name: 'Marta Kowalska',
  email: 'marta.kowalska@example.com',
  role: 'employee',
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem('kup50-access-token'),
  );
  const [user, setUser] = useState<MockUser | null>(() => {
    const stored = localStorage.getItem('kup50-user');

    if (!stored) {
      return accessToken ? mockUser : null;
    }

    return JSON.parse(stored) as MockUser;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      login: async (email: string, password: string) => {
        const response = await loginRequest(email, password);
        const nextUser: MockUser = {
          id: response.user.id,
          name: response.user.fullname ?? response.user.email,
          email: response.user.email,
          role: response.user.role,
        };

        localStorage.setItem('kup50-access-token', response.accessToken);
        localStorage.setItem('kup50-user', JSON.stringify(nextUser));
        setAccessToken(response.accessToken);
        setUser(nextUser);
      },
      logout: () => {
        localStorage.removeItem('kup50-access-token');
        localStorage.removeItem('kup50-user');
        setAccessToken(null);
        setUser(null);
      },
    }),
    [accessToken, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
