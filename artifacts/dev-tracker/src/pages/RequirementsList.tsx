import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTrackerListRequirements, useTrackerListProjects, useTrackerListUsers, getTrackerListRequirementsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { Search, PlusCircle, AlertCircle, Circle, Clock, CheckCircle2, ArrowRightCircle, ListTodo, FolderKanban, User } from "lucide-react";
import { TrackerListRequirementsStatus } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function getInitialProjectId(): number | undefined {
  const params = new URLSearchParams(window.location.search);
  const val = params.get("project");
  if (val) {
    const n = parseInt(val);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

export default function RequirementsList() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<TrackerListRequirementsStatus>("all");
  const [mine, setMine] = useState(false);
  const [projectId, setProjectId] = useState<number | undefined>(getInitialProjectId());
  const [createdBy, setCreatedBy] = useState<number | undefined>(undefined);
  const [testedBy, setTestedBy] = useState<number | undefined>(undefined);
  const [assignedTo, setAssignedTo] = useState<number | undefined>(undefined);

  const { data: projects } = useTrackerListProjects();
  const { data: allUsers } = useTrackerListUsers();

  const { data: requirements, isLoading } = useTrackerListRequirements({
    search: debouncedSearch || undefined,
    status: status !== "all" ? status : undefined,
    mine: mine ? true : undefined,
    projectId: projectId,
    createdBy,
    testedBy,
    assignedTo,
  });

  const stageConfigs = [
    { key: 'all', label: 'All', icon: ListTodo },
    { key: 'open', label: 'Open', icon: Circle },
    { key: 'in_testing', label: 'In Testing', icon: Clock },
    { key: 'needs_fix', label: 'Needs Fix', icon: AlertCircle },
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
    { key: 'pushed_to_production', label: 'Production', icon: ArrowRightCircle },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Requirements</h1>
          <p className="text-muted-foreground">
            {user?.role === "admin" ? "Track and manage all development requirements." : "View your assigned requirements."}
          </p>
        </div>
        {(user?.role === "developer" || user?.role === "admin") && (
          <Link href="/requirements/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Requirement
            </Button>
          </Link>
        )}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search requirements..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch id="mine-only" checked={mine} onCheckedChange={setMine} />
              <Label htmlFor="mine-only" className="cursor-pointer">
                {user?.role === "admin" ? "Assigned to me" : "My assignments"}
              </Label>
            </div>

            <div className="flex items-center space-x-2 min-w-[200px]">
              <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select
                value={projectId?.toString() || "all"}
                onValueChange={(val) => setProjectId(val === "all" ? undefined : parseInt(val))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {(Array.isArray(projects) ? projects : []).map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {stageConfigs.map((config) => {
              const isSelected = status === config.key;
              return (
                <Badge
                  key={config.key}
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer px-3 py-1.5 transition-colors text-sm font-medium hover:bg-primary/90 hover:text-primary-foreground ${
                    !isSelected ? "bg-background text-foreground hover:bg-muted" : ""
                  }`}
                  onClick={() => setStatus(config.key as TrackerListRequirementsStatus)}
                >
                  <config.icon className="w-3 h-3 mr-1.5" />
                  {config.label}
                </Badge>
              );
            })}
          </div>

          {user?.role === "admin" && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2 min-w-[180px]">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={createdBy?.toString() || "all"} onValueChange={(val) => setCreatedBy(val === "all" ? undefined : parseInt(val))}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Created by anyone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Created by anyone</SelectItem>
                    {(Array.isArray(allUsers) ? allUsers : []).map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 min-w-[180px]">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={testedBy?.toString() || "all"} onValueChange={(val) => setTestedBy(val === "all" ? undefined : parseInt(val))}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Tested by anyone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tested by anyone</SelectItem>
                    {(Array.isArray(allUsers) ? allUsers : []).filter((u) => u.role === "tester").map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 min-w-[180px]">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={assignedTo?.toString() || "all"} onValueChange={(val) => setAssignedTo(val === "all" ? undefined : parseInt(val))}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Assigned to anyone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Assigned to anyone</SelectItem>
                    {(Array.isArray(allUsers) ? allUsers : []).map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : (Array.isArray(requirements) && requirements.length === 0) ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ListTodo className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold">No requirements found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-2">
                Try adjusting your search or filters to find what you're looking for.
              </p>
              {(user?.role === "developer" || user?.role === "admin") && (
                <Link href="/requirements/new" className="mt-6">
                  <Button variant="outline">Create your first requirement</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          (Array.isArray(requirements) ? requirements : []).map((req, index) => (
            <Link key={req.id} href={`/requirements/${req.id}`}>
              <Card className="hover:border-primary/30 transition-all cursor-pointer group shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{req.title}</h3>
                      </div>
                      <div className="flex items-center gap-x-4 gap-y-2 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-primary/60"></div>
                          Dev: <span className="font-medium text-foreground">{req.developerName}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500/60"></div>
                          Assigned: <span className="font-medium text-foreground">{req.assigneeName || req.developerName}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-secondary-foreground/40"></div>
                          QA: <span className="font-medium text-foreground">{req.testerName || "Unassigned"}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <FolderKanban className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">{req.projectName}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Updated {format(new Date(req.updatedAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={req.priority === 'high' ? 'destructive' : req.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                            {req.priority}
                          </Badge>
                          <Badge variant="outline" className={`text-xs border ${
                            req.status === 'open' ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                            req.status === 'in_testing' ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                            req.status === 'needs_fix' ? 'border-destructive/50 bg-destructive/10 text-destructive' :
                            req.status === 'confirmed' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                            'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400'
                          }`}>
                            {req.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          {req.testCycles} cycle{req.testCycles !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
