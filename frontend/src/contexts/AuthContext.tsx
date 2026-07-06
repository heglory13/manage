import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { api, clearAuthTokens, storeAuthTokens } from '../services/api';

type PermissionFlags = {
  view: boolean;
  create: boolean;
  save: boolean;
  edit: boolean;
  delete: boolean;
};

type PermissionState = Record<string, PermissionFlags>;

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  permissions?: PermissionState;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      name: payload.email.split('@')[0],
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const res = await api.post('/auth/me');
    setUser(res.data);
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      if (!token) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        try {
          const res = await api.post('/auth/refresh', { refreshToken });
          storeAuthTokens(res.data.accessToken, res.data.refreshToken);
          setToken(res.data.accessToken);
        } catch {
          clearAuthTokens();
          setUser(null);
          setToken(null);
          setIsLoading(false);
        }
        return;
      }

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const decodedUser = decodeToken(token);
      if (decodedUser) {
        setUser({ ...decodedUser, name: decodedUser.email.split('@')[0] });
      }

      try {
        await refreshUser();
      } catch {
        clearAuthTokens();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrapAuth();
  }, [token]);

  const login = async ({ email, password }: { email: string; password: string }) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken } = res.data;

    storeAuthTokens(accessToken, refreshToken);
    setToken(accessToken);

    const decodedUser = decodeToken(accessToken);
    if (decodedUser) {
      setUser({ ...decodedUser, email });
    }

    await refreshUser();
  };

  const logout = () => {
    clearAuthTokens();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
