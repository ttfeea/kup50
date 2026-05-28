import {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react';

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager';
};

type AuthContextValue = {
  user: MockUser | null;
  isAuthenticated: boolean;
  login: () => void;
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
  const [user, setUser] = useState<MockUser | null>(mockUser);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login: () => setUser(mockUser),
      logout: () => setUser(null),
    }),
    [user],
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
