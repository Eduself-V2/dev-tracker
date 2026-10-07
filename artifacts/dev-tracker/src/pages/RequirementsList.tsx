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
  CalendarDays, Pin, SlidersHorizontal, ChevronDown, X,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangeFilter, startOfLocalDay, endOfLocalDay, type DateRangePreset } from "@/components/DateRangeFilter";
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

function FilterField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      {children}
    </div>
  );
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
  const [showFilters, setShowFilters] = useState(false);

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
      if (createdFrom && created < startOfLocalDay(createdFrom)) return false;
      if (createdTo && created > endOfLocalDay(createdTo)) return false;
      if (updatedFrom && updated < startOfLocalDay(updatedFrom)) return false;
      if (updatedTo && updated > endOfLocalDay(updatedTo)) return false;
      return true;
    })
    .sort((a, b) => {
      if (prioritySort === "high_first") return priorityOrder[b.priority] - priorityOrder[a.priority];
      if (prioritySort === "low_first") return priorityOrder[a.priority] - priorityOrder[b.priority];
      return 0;
    });

  const activeFilterCount = [
    statusFilter.length > 0,
    mine,
    projectIds.length > 0,
    priorityFilter !== "all",
    createdBy !== undefined,
    testedBy !== undefined,
    assignedTo !== undefined,
    createdPreset !== "all",
    updatedPreset !== "all",
  ].filter(Boolean).length;

  function clearFilters() {
    setStatusFilter([]);
    setMine(false);
    setProjectIds([]);
    setPriorityFilter("all");
    setCreatedBy(undefined);
    setTestedBy(undefined);
    setAssignedTo(undefined);
    setCreatedPreset("all");
    setCreatedFrom("");
    setCreatedTo("");
    setUpdatedPreset("all");
    setUpdatedFrom("");
    setUpdatedTo("");
  }

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
          {/* Row 1: search, quick toggles, sort */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search requirements..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant={showFilters ? "secondary" : "outline"}
                className="md:hidden shrink-0 h-9"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
              >
                <SlidersHorizontal className="h-4 w-4 mr-1.5" />
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <Switch id="mine-only" checked={mine} onCheckedChange={setMine} />
                <Label htmlFor="mine-only" className="cursor-pointer whitespace-nowrap">
                  {user?.role === "admin" ? "Assigned to me" : "My assignments"}
                </Label>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                <Select
                  value={prioritySort}
                  onValueChange={(val) => setPrioritySort(val as "none" | "high_first" | "low_first")}
                >
                  <SelectTrigger className="w-[170px] max-w-full" aria-label="Sort order">
                    <SelectValue placeholder="Sort by priority" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="none">Default order</SelectItem>
                    <SelectItem value="high_first">High priority first</SelectItem>
                    <SelectItem value="low_first">Low priority first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Row 2: status chips (single swipeable row on mobile) */}
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap [scrollbar-width:none]">
            {stageConfigs.map((config) => {
              const isSelected = config.key === "all" ? statusFilter.length === 0 : statusFilter.includes(config.key);
              return (
                <button
                  key={config.key}
                  type="button"
                  aria-pressed={isSelected}
                  className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium transition-colors touch-manipulation ${
                    isSelected
                      ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-border bg-background text-foreground hover:bg-muted"
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
                  <config.icon className="w-3.5 h-3.5 mr-1.5" />
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Row 3: detailed filters — always visible on desktop, toggled on mobile */}
          <div
            className={`${showFilters ? "grid" : "hidden"} md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 pt-4 border-t border-border/40`}
          >
            <FilterField label="Project" icon={FolderKanban}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-between font-normal px-3">
                    <span className="truncate">
                      {projectIds.length === 0
                        ? "All projects"
                        : projectIds.length === 1
                          ? (Array.isArray(projects) ? projects : []).find((p) => p.id === projectIds[0])?.name ?? "1 project"
                          : `${projectIds.length} projects`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
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
            </FilterField>

            <FilterField label="Priority" icon={AlertCircle}>
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
            </FilterField>

            <FilterField label="Created date" icon={CalendarDays}>
              <DateRangeFilter
                fullWidth
                className="w-full"
                preset={createdPreset}
                onPresetChange={setCreatedPreset}
                from={createdFrom}
                to={createdTo}
                onChange={(from, to) => { setCreatedFrom(from); setCreatedTo(to); }}
              />
            </FilterField>

            <FilterField label="Updated date" icon={CalendarDays}>
              <DateRangeFilter
                fullWidth
                className="w-full"
                preset={updatedPreset}
                onPresetChange={setUpdatedPreset}
                from={updatedFrom}
                to={updatedTo}
                onChange={(from, to) => { setUpdatedFrom(from); setUpdatedTo(to); }}
              />
            </FilterField>

            {user?.role === "admin" && (
              <>
                <FilterField label="Created by" icon={User}>
                  <Select value={createdBy?.toString() || "all"} onValueChange={(val) => setCreatedBy(val === "all" ? undefined : parseInt(val))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Anyone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Anyone</SelectItem>
                      {(Array.isArray(allUsers) ? allUsers : []).map((u) => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.name} ({u.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Tested by" icon={User}>
                  <Select value={testedBy?.toString() || "all"} onValueChange={(val) => setTestedBy(val === "all" ? undefined : parseInt(val))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Anyone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Anyone</SelectItem>
                      {(Array.isArray(allUsers) ? allUsers : []).filter((u) => u.role === "tester").map((u) => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Assigned to" icon={User}>
                  <Select value={assignedTo?.toString() || "all"} onValueChange={(val) => setAssignedTo(val === "all" ? undefined : parseInt(val))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Anyone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Anyone</SelectItem>
                      {(Array.isArray(allUsers) ? allUsers : []).map((u) => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.name} ({u.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
              </>
            )}

            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                className="w-full h-9 text-muted-foreground"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
              >
                <X className="h-4 w-4 mr-1.5" />
                Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
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
