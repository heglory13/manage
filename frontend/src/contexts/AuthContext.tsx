import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
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

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const decodedUser = decodeToken(token);
      if (decodedUser) {
        setUser({ ...decodedUser, name: decodedUser.email.split('@')[0] });
      }
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async ({ email, password }: { email: string; password: string }) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken } = res.data;
    
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    
    const decodedUser = decodeToken(accessToken);
    if (decodedUser) {
      setUser({ ...decodedUser, email });
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
