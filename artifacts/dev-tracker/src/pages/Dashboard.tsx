import { useState } from "react";
import {
  useTrackerStatsSummary,
  useTrackerListProjects,
  useTrackerListPins,
  useTrackerUnpinTask,
  getTrackerListPinsQueryKey,
} from "@workspace/api-client-react";
import type { PinItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  ArrowRightCircle,
  ListTodo,
  FolderKanban,
  Pin,
  X,
  Timer,
  Target,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  open: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  in_testing: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  needs_fix: "border-destructive/50 bg-destructive/10 text-destructive",
  confirmed: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pushed_to_production: "border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_testing: "In Testing",
  needs_fix: "Needs Fix",
  confirmed: "Confirmed",
  pushed_to_production: "In Production",
};

function formatCommitment(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes === 60) return "1 hour";
  if (minutes < 480) return `${minutes / 60} hours`;
  return "1 day";
}

function PinTimeInfo({ pin }: { pin: PinItem }) {
  if (!pin.committedMinutes) {
    return (
      <span className="text-xs text-muted-foreground">
        Pinned {formatDistanceToNow(new Date(pin.pinnedAt), { addSuffix: true })}
      </span>
    );
  }

  const deadline = new Date(new Date(pin.pinnedAt).getTime() + pin.committedMinutes * 60 * 1000);
  const minutesLeft = differenceInMinutes(deadline, new Date());

  if (minutesLeft > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Timer className="w-3 h-3" />
        {formatCommitment(minutesLeft)} left · {formatCommitment(pin.committedMinutes)} commitment
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-destructive font-medium">
      <Timer className="w-3 h-3" />
      Overdue by {formatCommitment(Math.abs(minutesLeft))} · {formatCommitment(pin.committedMinutes)} commitment
    </span>
  );
}

function TodaysGoals() {
  const { data: pins, isLoading } = useTrackerListPins();
  const unpinMutation = useTrackerUnpinTask();
  const qc = useQueryClient();

  const pinList = Array.isArray(pins) ? pins : [];

  function handleUnpin(e: React.MouseEvent, requirementId: number) {
    e.preventDefault();
    e.stopPropagation();
    unpinMutation.mutate(requirementId, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getTrackerListPinsQueryKey() }),
    });
  }

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Today's Goals</CardTitle>
          {pinList.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {pinList.length} pinned
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : pinList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Pin className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No goals pinned yet</p>
            <p className="text-xs mt-1 max-w-xs">
              Pin tasks from the Requirements list to set your targets for today.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pinList.map((pin) => (
              <Link key={pin.id} href={`/requirements/${pin.requirementId}`}>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer group">
                  <Pin className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {pin.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-xs border ${statusColors[pin.status] ?? ""}`}
                      >
                        {statusLabels[pin.status] ?? pin.status.replace(/_/g, " ")}
                      </Badge>
                      <PinTimeInfo pin={pin} />
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleUnpin(e, pin.requirementId)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const { data: stats, isLoading } = useTrackerStatsSummary({ projectId });
  const { data: projects } = useTrackerListProjects();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!stats) return null;

  const recentItems = Array.isArray(stats.recent) ? stats.recent : [];
  const projectList = Array.isArray(projects) ? projects : [];

  const stageConfigs = [
    { key: "open", label: "Open", value: stats.open ?? 0, icon: Circle, color: "text-blue-500", bg: "bg-blue-500/10" },
    { key: "inTesting", label: "In Testing", value: stats.inTesting ?? 0, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { key: "needsFix", label: "Needs Fix", value: stats.needsFix ?? 0, icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
    { key: "confirmed", label: "Confirmed", value: stats.confirmed ?? 0, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { key: "pushedToProduction", label: "Production", value: stats.pushedToProduction ?? 0, icon: ArrowRightCircle, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Command Station</h1>
          <p className="text-muted-foreground">
            Overview of the squad's current requirements and workflow.
          </p>
        </div>
        <div className="flex items-center gap-2 min-w-[220px]">
          <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={projectId?.toString() || "all"}
            onValueChange={(val) => setProjectId(val === "all" ? undefined : parseInt(val))}
          >
            <SelectTrigger>
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projectList.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Requirements</CardTitle>
            <ListTodo className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-secondary/30 border-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">My Open Assigned</CardTitle>
            <AlertCircle className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.myOpen ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {stageConfigs.map((config) => (
          <Card key={config.key} className="overflow-hidden border-border/50 transition-colors hover:border-border">
            <CardHeader className={`flex flex-row items-center justify-between pb-2 space-y-0 border-b ${config.bg}`}>
              <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
              <config.icon className={`h-4 w-4 ${config.color}`} />
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{config.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <TodaysGoals />

      <div className="grid gap-4 md:grid-cols-1">
        <Card className="col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle>Recently Updated</CardTitle>
          </CardHeader>
          <CardContent>
            {recentItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <ListTodo className="h-12 w-12 mb-4 opacity-20" />
                <p>No recent requirements to show.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentItems.map((req) => (
                  <Link key={req.id} href={`/requirements/${req.id}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                          {req.title}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Last activity {format(new Date(req.lastActivityAt ?? req.updatedAt), "MMM d, h:mm a")}
                          {req.lastUpdatedByName && (
                            <span className="ml-1">· by <span className="font-medium text-foreground">{req.lastUpdatedByName}</span></span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                        <Badge variant="outline" className="capitalize">
                          {req.status.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant={req.priority === "high" ? "destructive" : req.priority === "medium" ? "default" : "secondary"}>
                          {req.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FolderKanban className="w-3 h-3" />
                          {req.projectName}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
