import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";

// Lazy loading or direct imports for pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import RequirementsList from "@/pages/RequirementsList";
import RequirementCreate from "@/pages/RequirementCreate";
import RequirementDetail from "@/pages/RequirementDetail";
import Users from "@/pages/Users";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={Dashboard} />
        <Route path="/requirements" component={RequirementsList} />
        <Route path="/requirements/new" component={RequirementCreate} />
        <Route path="/requirements/:id" component={RequirementDetail} />
        <Route path="/users" component={Users} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
