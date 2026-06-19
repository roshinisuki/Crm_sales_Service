"use client";

import { createContext, useContext, useState } from "react";

type Role = "Admin" | "SalesManager" | "SalesExecutive" | "Customer";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  theme?: string;
  themeMode?: string;
  variant?: number;
  company?: {
    id: string;
    name: string;
    variant?: number;
  } | null;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: false });

export function AuthProvider({ children, initialUser = null }: { children: React.ReactNode, initialUser?: UserProfile | null }) {
  return (
    <AuthContext.Provider value={{ user: initialUser, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
