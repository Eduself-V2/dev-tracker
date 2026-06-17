import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTrackerLogout, getTrackerMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Activity, LayoutDashboard, ListTodo, PlusCircle, Users, FolderKanban, BarChart2, Moon, Sun } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/lib/theme";

export function Navbar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  
  const logout = useTrackerLogout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getTrackerMeQueryKey() });
        queryClient.clear();
      },
      onError: () => {
        toast({ title: "Logout failed", variant: "destructive" });
      }
    }
  });

  if (!user) return null;

  const getInitials = (name: string) => (name ?? "").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/requirements", label: "Requirements", icon: ListTodo, show: true },
    { href: "/requirements/new", label: "New Requirement", icon: PlusCircle, show: user.role === "admin" || user.role === "developer" },
    { href: "/reports", label: "Reports", icon: BarChart2, show: true },
    { href: "/projects", label: "Projects", icon: FolderKanban, show: user.role === "admin" },
    { href: "/users", label: "Users", icon: Users, show: user.role === "admin" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center max-w-7xl mx-auto px-4 md:px-6">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block">Dev Tracker</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navItems.filter(i => i.show).map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors hover:text-foreground/80 flex items-center gap-2 ${
                  location === item.href ? "text-foreground" : "text-foreground/60"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
          </div>
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8" aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      @{user.username}
                    </p>
                    <div className="mt-1">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                        {user.role}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout.mutate(undefined)} disabled={logout.isPending} className="text-destructive focus:text-destructive cursor-pointer">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>
    </header>
  );
}
