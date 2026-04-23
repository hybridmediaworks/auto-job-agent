/* eslint-disable react-refresh/only-export-components */
/**
 * Authentication Context
 *
 * Auth state is derived from the HttpOnly cookie set by the backend.
 * JS cannot read the cookie directly — instead we call GET /api/auth/me
 * on mount to check if a valid session exists. On login, the backend
 * sets the cookie and returns the user object in the response body.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '@/services/api';
import type { User, LoginRequest, RegisterRequest, RegisterResponse } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterRequest) => Promise<RegisterResponse>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * On mount: try to restore the session from the HttpOnly cookie.
   * If the cookie is absent or expired, /me returns 401 → we stay logged out.
   * Cap at 4 seconds to avoid infinite loading if the backend is slow.
   */
  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);

    authApi.getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) {
          clearTimeout(timer);
          setUser(currentUser);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timer);
          setLoading(false);
        }
      });

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  /**
   * Periodically re-fetch the user's permissions so that if an admin revokes
   * access while the user is logged in, the sidebar updates within ~60 seconds.
   * Also re-fetches immediately when the tab regains focus.
   */
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      authApi.getCurrentUser()
        .then(setUser)
        .catch((err) => {
          // Only log out on explicit 401 — ignore network errors and server restarts
          if (err?.response?.status === 401) setUser(null);
        });
    };

    const interval = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  /**
   * Login — backend sets the HttpOnly cookie and returns user info in body.
   * No localStorage involved.
   */
  const login = async (credentials: LoginRequest): Promise<void> => {
    const response = await authApi.login(credentials);
    setUser(response.user);
  };

  /**
   * Logout — asks the backend to clear the cookie, then resets local state.
   */
  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Even if the request fails, clear local state so the UI shows login
    }
    setUser(null);
  };

  /**
   * Register — creates the account and sends the verification email.
   * Does NOT log the user in (they must verify email first).
   */
  const register = async (data: RegisterRequest): Promise<RegisterResponse> => {
    return authApi.register(data);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    register,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
