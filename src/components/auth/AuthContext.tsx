"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchWithAuth, setTokens, clearTokens, DJANGO_API_BASE } from "@/lib/auth";

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginUser: (access: string, refresh: string) => void;
  logoutUser: () => void;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginUser: () => {},
  logoutUser: () => {},
  isAuthModalOpen: false,
  setAuthModalOpen: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetchWithAuth(`${DJANGO_API_BASE}/auth/me/`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        clearTokens();
        setUser(null);
      }
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loginUser = async (access: string, refresh: string) => {
    setTokens(access, refresh);
    await checkAuth();
  };

  const logoutUser = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, isAuthModalOpen, setAuthModalOpen }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
