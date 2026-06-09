import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

// Auto-logout the user after 6 hours of inactivity
const INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;

interface AuthContextType {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize auth state synchronously from localStorage to avoid redirect flashes on refresh
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('accessToken'));

  const login = useCallback(async (token: string) => {
    localStorage.setItem('accessToken', token);
    setIsAuthenticated(true);
    // Clear Apollo cache to avoid stale user/session views on role switch
    try {
      const apollo: any = (window as any).__APOLLO_CLIENT__;
      if (apollo && typeof apollo.clearStore === 'function') {
        await apollo.clearStore();
      }
    } catch {}
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem('accessToken');
    setIsAuthenticated(false);
    try {
      const apollo: any = (window as any).__APOLLO_CLIENT__;
      if (apollo && typeof apollo.clearStore === 'function') {
        await apollo.clearStore();
      }
    } catch {}
  }, []);

  // Inactivity timeout: automatically log out the user after 6 hours of no activity
  useEffect(() => {
    if (!isAuthenticated) return;

    const timeoutRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };
    const lastResetRef: { current: number } = { current: 0 };

    const scheduleLogout = () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(logout, INACTIVITY_TIMEOUT_MS);
    };

    // Always reset on meaningful user interactions
    const resetTimer = () => {
      lastResetRef.current = Date.now();
      scheduleLogout();
    };

    // Throttled reset for high-frequency events (mousemove, scroll) — at most once per 10 s
    const throttledResetTimer = () => {
      const now = Date.now();
      if (now - lastResetRef.current < 10_000) return;
      lastResetRef.current = now;
      scheduleLogout();
    };

    const highFreqEvents = ['mousemove', 'scroll'];
    const lowFreqEvents = ['mousedown', 'keypress', 'touchstart', 'click'];
    highFreqEvents.forEach(ev => window.addEventListener(ev, throttledResetTimer, { passive: true }));
    lowFreqEvents.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    scheduleLogout();

    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      highFreqEvents.forEach(ev => window.removeEventListener(ev, throttledResetTimer));
      lowFreqEvents.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [isAuthenticated, logout]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Create a custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};