import { createContext, useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { useTrackerMe } from "@workspace/api-client-react";
import type { TrackerUser } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: TrackerUser | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, isLoading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useTrackerMe({
    query: {
      retry: false,
    }
  });

  useEffect(() => {
    if (!isLoading) {
      if (isError || !user) {
        if (location !== "/login") {
          setLocation("/login");
        }
      } else if (location === "/login") {
        setLocation("/");
      }
    }
  }, [isLoading, isError, user, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium animate-pulse">Initializing Command Station...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
