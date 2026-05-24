import { useState } from "react";
import { useTrackerStatsSummary, useTrackerListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Circle, Clock, ArrowRightCircle, ListTodo, FolderKanban } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const stageConfigs = [
    { key: 'open', label: 'Open', value: stats.open, icon: Circle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { key: 'inTesting', label: 'In Testing', value: stats.inTesting, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { key: 'needsFix', label: 'Needs Fix', value: stats.needsFix, icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
    { key: 'confirmed', label: 'Confirmed', value: stats.confirmed, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { key: 'pushedToProduction', label: 'Production', value: stats.pushedToProduction, icon: ArrowRightCircle, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Command Station</h1>
          <p className="text-muted-foreground">Overview of the squad's current requirements and workflow.</p>
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
              {projects?.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
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
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-secondary/30 border-secondary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">My Open Assigned</CardTitle>
            <AlertCircle className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.myOpen}</div>
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

      <div className="grid gap-4 md:grid-cols-1">
        <Card className="col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <ListTodo className="h-12 w-12 mb-4 opacity-20" />
                <p>No recent requirements to show.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recent.map((req) => (
                  <Link key={req.id} href={`/requirements/${req.id}`}>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-base group-hover:text-primary transition-colors">{req.title}</span>
                        <span className="text-sm text-muted-foreground">
                          Updated {format(new Date(req.updatedAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="capitalize">
                          {req.status.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant={req.priority === 'high' ? 'destructive' : req.priority === 'medium' ? 'default' : 'secondary'}>
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
