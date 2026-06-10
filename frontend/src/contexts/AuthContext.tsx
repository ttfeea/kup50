import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getMeRequest,
  loginRequest,
  UpdateMeInput,
  updateMeRequest,
} from '../api/auth';
import { UserDto, UserRole } from '../api/contracts';
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
} from '../constants/emailTemplates';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId: string;
  position: string;
  department: string;
  managerName: string;
  managerEmail: string;
  reportReceiverEmail: string;
  reportEmailSubjectTemplate: string;
  reportEmailBodyTemplate: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
  updateProfile: (profile: UpdateMeInput) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapUser(user: UserDto): AuthUser {
  return {
    id: user.id,
    name: user.fullname?.trim() || user.email,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId?.trim() || '',
    position: user.position?.trim() || '',
    department: user.department?.trim() || '',
    managerName: user.managerName?.trim() || '',
    managerEmail: user.managerEmail?.trim() || '',
    reportReceiverEmail:
      user.reportReceiverEmail?.trim() || user.managerEmail?.trim() || '',
    reportEmailSubjectTemplate:
      user.reportEmailSubjectTemplate?.trim() || DEFAULT_EMAIL_SUBJECT,
    reportEmailBodyTemplate:
      user.reportEmailBodyTemplate?.trim() || DEFAULT_EMAIL_BODY,
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
        managerEmail: parsed.managerEmail || '',
        reportReceiverEmail:
          parsed.reportReceiverEmail || parsed.managerEmail || '',
        reportEmailSubjectTemplate:
          parsed.reportEmailSubjectTemplate || DEFAULT_EMAIL_SUBJECT,
        reportEmailBodyTemplate:
          parsed.reportEmailBodyTemplate || DEFAULT_EMAIL_BODY,
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
    async (profile: UpdateMeInput) => {
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
      login: async (email: string) => {
        const response = await loginRequest(email);
        const nextUser = mapUser(response.user);

        localStorage.setItem('kup50-access-token', response.accessToken);
        localStorage.setItem('kup50-user', JSON.stringify(nextUser));
        localStorage.setItem('lastEmail', nextUser.email);
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
