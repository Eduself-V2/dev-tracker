import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useTrackerListRequirements,
  useTrackerListProjects,
  useTrackerListUsers,
  useTrackerListPins,
  useTrackerPinTask,
  useTrackerUnpinTask,
  getTrackerListRequirementsQueryKey,
  getTrackerListPinsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import {
  Search, PlusCircle, AlertCircle, Circle, Clock, CheckCircle2,
  ArrowRightCircle, ListTodo, FolderKanban, User, ArrowUpDown,
  CalendarDays, Pin,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangeFilter, type DateRangePreset } from "@/components/DateRangeFilter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";

const statusLabels: Record<string, string> = {
  open: "Open",
  in_testing: "In Testing",
  needs_fix: "Needs Fix",
  confirmed: "Confirmed",
  pushed_to_production: "In Production",
};

const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };

const TIME_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: "No commitment", minutes: null },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
  { label: "1 day (8h)", minutes: 480 },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function getInitialProjectIds(): number[] {
  const params = new URLSearchParams(window.location.search);
  const val = params.get("project");
  if (!val) return [];
  return val
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

type PinDialogState = {
  requirementId: number;
  title: string;
  currentCommittedMinutes: number | null;
  isPinned: boolean;
};

function PinDialog({ state, onClose }: { state: PinDialogState; onClose: () => void }) {
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(state.currentCommittedMinutes);
  const pinMutation = useTrackerPinTask();
  const unpinMutation = useTrackerUnpinTask();
  const qc = useQueryClient();

  function handlePin() {
    pinMutation.mutate(
      { requirementId: state.requirementId, committedMinutes: selectedMinutes },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getTrackerListPinsQueryKey() });
          onClose();
        },
      },
    );
  }

  function handleUnpin() {
    unpinMutation.mutate(state.requirementId, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getTrackerListPinsQueryKey() });
        onClose();
      },
    });
  }

  const isBusy = pinMutation.isPending || unpinMutation.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary" />
            {state.isPinned ? "Update Goal" : "Set Today's Goal"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1 mb-1 line-clamp-2">{state.title}</p>

        <div className="space-y-2">
          <p className="text-sm font-medium">Time commitment</p>
          <div className="grid grid-cols-2 gap-2">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.minutes ?? "none"}
                onClick={() => setSelectedMinutes(opt.minutes)}
                className={`text-sm px-3 py-2 rounded-lg border transition-colors text-left ${
                  selectedMinutes === opt.minutes
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="flex gap-2 mt-2">
          {state.isPinned && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleUnpin}
              disabled={isBusy}
            >
              Unpin
            </Button>
          )}
          <Button size="sm" onClick={handlePin} disabled={isBusy} className="flex-1">
            <Pin className="h-3.5 w-3.5 mr-1.5" />
            {state.isPinned ? "Update" : "Pin Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RequirementsList() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [mine, setMine] = useState(false);
  const [projectIds, setProjectIds] = useState<number[]>(getInitialProjectIds());
  const [createdBy, setCreatedBy] = useState<number | undefined>(undefined);
  const [testedBy, setTestedBy] = useState<number | undefined>(undefined);
  const [assignedTo, setAssignedTo] = useState<number | undefined>(undefined);
  const [prioritySort, setPrioritySort] = useState<"none" | "high_first" | "low_first">("none");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [createdPreset, setCreatedPreset] = useState<DateRangePreset>("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedPreset, setUpdatedPreset] = useState<DateRangePreset>("all");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [pinDialog, setPinDialog] = useState<PinDialogState | null>(null);

  const { data: projects } = useTrackerListProjects();
  const { data: allUsers } = useTrackerListUsers();
  const { data: pins } = useTrackerListPins();

  const pinnedIds = new Set((Array.isArray(pins) ? pins : []).map((p) => p.requirementId));
  const pinnedMinutesMap = new Map(
    (Array.isArray(pins) ? pins : []).map((p) => [p.requirementId, p.committedMinutes]),
  );

  const { data: requirements, isLoading } = useTrackerListRequirements({
    search: debouncedSearch || undefined,
    status: statusFilter.length > 0 ? statusFilter.join(",") : undefined,
    mine: mine ? true : undefined,
    projectId: projectIds.length > 0 ? projectIds.join(",") : undefined,
    createdBy,
    testedBy,
    assignedTo,
  });

  const sortedRequirements = [...(Array.isArray(requirements) ? requirements : [])]
    .filter((r) => {
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      const created = new Date(r.createdAt);
      const updated = new Date(r.updatedAt);
      if (createdFrom && created < new Date(createdFrom)) return false;
      if (createdTo && created > new Date(createdTo + "T23:59:59")) return false;
      if (updatedFrom && updated < new Date(updatedFrom)) return false;
      if (updatedTo && updated > new Date(updatedTo + "T23:59:59")) return false;
      return true;
    })
    .sort((a, b) => {
      if (prioritySort === "high_first") return priorityOrder[b.priority] - priorityOrder[a.priority];
      if (prioritySort === "low_first") return priorityOrder[a.priority] - priorityOrder[b.priority];
      return 0;
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
      {pinDialog && (
        <PinDialog state={pinDialog} onClose={() => setPinDialog(null)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Requirements</h1>
          <p className="text-muted-foreground">
            {user?.role === "admin" ? "Track and manage all development requirements." : "View your assigned requirements."}
          </p>
        </div>
        {(user?.role === "developer" || user?.role === "admin" || user?.role === "manager") && (
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {projectIds.length === 0
                      ? "All projects"
                      : projectIds.length === 1
                        ? (Array.isArray(projects) ? projects : []).find((p) => p.id === projectIds[0])?.name ?? "1 project"
                        : `${projectIds.length} projects`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuCheckboxItem
                    checked={projectIds.length === 0}
                    onCheckedChange={() => setProjectIds([])}
                  >
                    All projects
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {(Array.isArray(projects) ? projects : []).map((p) => (
                    <DropdownMenuCheckboxItem
                      key={p.id}
                      checked={projectIds.includes(p.id)}
                      onCheckedChange={(checked) =>
                        setProjectIds((prev) =>
                          checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                        )
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      {p.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center space-x-2 min-w-[180px]">
              <Select
                value={priorityFilter}
                onValueChange={(val) => setPriorityFilter(val as "all" | "high" | "medium" | "low")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="high">🔴 High</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 min-w-[200px]">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select
                value={prioritySort}
                onValueChange={(val) => setPrioritySort(val as "none" | "high_first" | "low_first")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default order</SelectItem>
                  <SelectItem value="high_first">High priority first</SelectItem>
                  <SelectItem value="low_first">Low priority first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {stageConfigs.map((config) => {
              const isSelected = config.key === "all" ? statusFilter.length === 0 : statusFilter.includes(config.key);
              return (
                <Badge
                  key={config.key}
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer px-3 py-1.5 transition-colors text-sm font-medium hover:bg-primary/90 hover:text-primary-foreground ${
                    !isSelected ? "bg-background text-foreground hover:bg-muted" : ""
                  }`}
                  onClick={() => {
                    if (config.key === "all") {
                      setStatusFilter([]);
                      return;
                    }
                    setStatusFilter((prev) =>
                      prev.includes(config.key)
                        ? prev.filter((s) => s !== config.key)
                        : [...prev, config.key],
                    );
                  }}
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

          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/40">
            <div className="flex items-center gap-2 flex-1">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <DateRangeFilter
                label="Created"
                preset={createdPreset}
                onPresetChange={setCreatedPreset}
                from={createdFrom}
                to={createdTo}
                onChange={(from, to) => { setCreatedFrom(from); setCreatedTo(to); }}
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <DateRangeFilter
                label="Updated"
                preset={updatedPreset}
                onPresetChange={setUpdatedPreset}
                from={updatedFrom}
                to={updatedTo}
                onChange={(from, to) => { setUpdatedFrom(from); setUpdatedTo(to); }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground px-1">
        Showing <span className="font-medium text-foreground">{sortedRequirements.length}</span>{" "}
        requirement{sortedRequirements.length === 1 ? "" : "s"}
      </p>

      <div className="space-y-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : (sortedRequirements.length === 0) ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ListTodo className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold">No requirements found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-2">
                Try adjusting your search or filters to find what you're looking for.
              </p>
              {(user?.role === "developer" || user?.role === "admin" || user?.role === "manager") && (
                <Link href="/requirements/new" className="mt-6">
                  <Button variant="outline">Create your first requirement</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          sortedRequirements.map((req, index) => {
            const isPinned = pinnedIds.has(req.id);
            return (
              <Link key={req.id} href={`/requirements/${req.id}`}>
                <Card
                  className="hover:border-primary/30 transition-all cursor-pointer group shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{req.title}</h3>
                          {isPinned && (
                            <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-x-4 gap-y-2 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-primary/60"></div>
                            Dev: <span className="font-medium text-foreground">{req.developerName}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500/60"></div>
                            Assigned: <span className="font-medium text-foreground">
                              {((req as any).assigneeNames?.length ?? 0) > 0
                                ? (req as any).assigneeNames!.join(", ")
                                : req.developerName}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-secondary-foreground/40"></div>
                            QA: <span className="font-medium text-foreground">{(req as any).testerNames?.join(", ") || "Unassigned"}</span>
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
                            <Badge
                              variant={req.priority === 'high' ? 'destructive' : req.priority === 'medium' ? 'default' : 'secondary'}
                              className="text-xs capitalize"
                            >
                              {req.priority === 'high' ? '🔴 High' : req.priority === 'medium' ? '🟡 Medium' : '🟢 Low'}
                            </Badge>
                            <Badge variant="outline" className={`text-xs border font-medium ${
                              req.status === 'open' ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                              req.status === 'in_testing' ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                              req.status === 'needs_fix' ? 'border-destructive/50 bg-destructive/10 text-destructive' :
                              req.status === 'confirmed' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                              'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400'
                            }`}>
                              {statusLabels[req.status] ?? req.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                              {req.testCycles} test cycle{req.testCycles !== 1 ? 's' : ''}
                            </span>
                            <button
                              title={isPinned ? "Update goal / unpin" : "Pin as today's goal"}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPinDialog({
                                  requirementId: req.id,
                                  title: req.title,
                                  currentCommittedMinutes: pinnedMinutesMap.get(req.id) ?? null,
                                  isPinned,
                                });
                              }}
                              className={`p-1.5 rounded-md transition-colors border ${
                                isPinned
                                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                  : "border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5"
                              }`}
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
