import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getMeRequest, loginRequest, updateMeRequest } from '../api/auth';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager';
  employeeId: string;
  position: string;
  department: string;
  managerName: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (profile: {
    fullname?: string;
    employeeId?: string;
    position?: string;
    department?: string;
    managerName?: string;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapUser(user: {
  id: string;
  email: string;
  role: 'employee' | 'manager';
  fullname?: string | null;
  employeeId?: string | null;
  position?: string | null;
  department?: string | null;
  managerName?: string | null;
}): AuthUser {
  return {
    id: user.id,
    name: user.fullname?.trim() || user.email,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId?.trim() || '',
    position: user.position?.trim() || '',
    department: user.department?.trim() || '',
    managerName: user.managerName?.trim() || '',
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem('kup50-access-token'),
  );
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('kup50-user');

    if (!stored) {
      return null;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<AuthUser>;

      if (!parsed?.id || !parsed?.email || !parsed?.role) {
        return null;
      }

      return {
        id: parsed.id,
        name: parsed.name || parsed.email,
        email: parsed.email,
        role: parsed.role,
        employeeId: parsed.employeeId || '',
        position: parsed.position || '',
        department: parsed.department || '',
        managerName: parsed.managerName || '',
      };
    } catch {
      return null;
    }
  });
  const [isBootstrapping, setIsBootstrapping] = useState(() =>
    Boolean(localStorage.getItem('kup50-access-token')),
  );

  const logout = useCallback(() => {
    localStorage.removeItem('kup50-access-token');
    localStorage.removeItem('kup50-user');
    setAccessToken(null);
    setUser(null);
    setIsBootstrapping(false);
  }, []);

  const updateProfile = useCallback(
    async (profile: {
      fullname?: string;
      employeeId?: string;
      position?: string;
      department?: string;
      managerName?: string;
    }) => {
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const updatedUser = await updateMeRequest(accessToken, profile);
      const nextUser = mapUser(updatedUser);
      localStorage.setItem('kup50-user', JSON.stringify(nextUser));
      setUser(nextUser);
    },
    [accessToken],
  );

  useEffect(() => {
    if (!accessToken) {
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;

    async function bootstrapSession() {
      setIsBootstrapping(true);

      try {
        const profile = await getMeRequest(accessToken!);
        if (cancelled) {
          return;
        }

        const nextUser = mapUser(profile);
        localStorage.setItem('kup50-user', JSON.stringify(nextUser));
        setUser(nextUser);
      } catch {
        if (!cancelled) {
          logout();
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [accessToken, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      isBootstrapping,
      login: async (email: string, password: string) => {
        const response = await loginRequest(email, password);
        const nextUser = mapUser(response.user);

        localStorage.setItem('kup50-access-token', response.accessToken);
        localStorage.setItem('kup50-user', JSON.stringify(nextUser));
        setAccessToken(response.accessToken);
        setUser(nextUser);
        setIsBootstrapping(false);
      },
      logout,
      updateProfile,
    }),
    [accessToken, user, isBootstrapping, logout, updateProfile],
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
