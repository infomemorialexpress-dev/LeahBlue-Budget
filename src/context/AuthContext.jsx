import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  login as loginRequest,
  register as registerRequest,
} from '../services/api.js';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(() => readStoredUser());

  const persistSession = useCallback((nextToken, nextUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await loginRequest({ email, password });
      persistSession(data.token, data.user);
      return data;
    },
    [persistSession],
  );

  const register = useCallback(
    async (email, password, accessKey) => {
      const data = await registerRequest({ email, password, accessKey });
      persistSession(data.token, data.user);
      return data;
    },
    [persistSession],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout,
    }),
    [user, token, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

