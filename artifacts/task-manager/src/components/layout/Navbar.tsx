import { Link, useLocation } from "wouter";
import { Show, useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckSquare, LayoutDashboard, LogOut } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-serif font-bold text-xl text-foreground">Tasker</span>
          </Link>
          
          <Show when="signed-in">
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/tasks" className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${location === '/tasks' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  <span>Tasks</span>
                </div>
              </Link>
              <Link href="/dashboard" className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${location === '/dashboard' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </div>
              </Link>
            </nav>
          </Show>
        </div>

        <div className="flex items-center gap-4">
          <Show when="signed-out">
            <Link href="/sign-in">
              <Button variant="ghost" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">Log in</Button>
            </Link>
            <Link href="/sign-up">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">Get started</Button>
            </Link>
          </Show>
          
          <Show when="signed-in">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-border/50 p-0 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.imageUrl} alt={user.fullName || "User"} />
                      <AvatarFallback className="bg-primary/10 text-primary">{user.firstName?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-foreground">{user.fullName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.primaryEmailAddress?.emailAddress}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="md:hidden">
                    <Link href="/tasks">
                      <DropdownMenuItem className="cursor-pointer">
                        <CheckSquare className="mr-2 h-4 w-4" />
                        <span>Tasks</span>
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/dashboard">
                      <DropdownMenuItem className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                  </div>
                  <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </Show>
        </div>
      </div>
    </header>
  );
}
