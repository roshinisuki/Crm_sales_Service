"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Role = "Admin" | "MarketingLead" | "MarketingExecutive" | "Customer";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/app/actions/auth").then(({ getMeAction }) => {
      getMeAction()
        .then((data: any) => {
          if (data.success && data.data) {
            setUser(data.data);
          } else {
            setUser(null);
          }
        })
        .catch((err: any) => {
          console.error("Failed to fetch user profile", err);
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
