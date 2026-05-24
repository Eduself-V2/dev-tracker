import { Navbar } from "./Navbar";
import { useAuth } from "@/lib/auth";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) return <>{children}</>;

  if (user.passwordResetRequired) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-muted/30">
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 md:pt-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/30">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 md:pt-8">
        {children}
      </main>
    </div>
  );
}
