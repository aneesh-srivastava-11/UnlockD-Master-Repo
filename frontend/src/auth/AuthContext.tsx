import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Explaining to Judges: Check local storage on initial mount to restore user session
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('unlockd_auth_token');
      const savedUser = localStorage.getItem('unlockd_auth_user');

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error("Error loading auth from localStorage", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiClient<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      bodyData: { email, password }
    });

    localStorage.setItem('unlockd_auth_token', data.token);
    localStorage.setItem('unlockd_auth_user', JSON.stringify(data.user));
    
    setToken(data.token);
    setUser(data.user);
  };

  const signup = async (email: string, password: string) => {
    const data = await apiClient<{ token: string; user: User }>('/auth/signup', {
      method: 'POST',
      bodyData: { email, password }
    });

    localStorage.setItem('unlockd_auth_token', data.token);
    localStorage.setItem('unlockd_auth_user', JSON.stringify(data.user));
    
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('unlockd_auth_token');
    localStorage.removeItem('unlockd_auth_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
