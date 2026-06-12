import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { BarChart2, MessageSquare, FolderKanban, UserCheck } from "lucide-react";

type UserReport = {
  userId: number;
  userName: string;
  tasksCreated: number;
  tasksAssigned: number;
  statusTransitions: {
    open: number;
    in_testing: number;
    needs_fix: number;
    confirmed: number;
    pushed_to_production: number;
  };
  comments: number;
};

type UserOption = { id: number; name: string; role: string };

const STATUS_COLORS: Record<string, string> = {
  open: "#94a3b8",
  in_testing: "#3b82f6",
  needs_fix: "#f59e0b",
  confirmed: "#10b981",
  pushed_to_production: "#8b5cf6",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_testing: "In Testing",
  needs_fix: "Needs Fix",
  confirmed: "Confirmed",
  pushed_to_production: "Pushed",
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");

  const isAdmin = user?.role === "admin";

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ["/api/tracker/users"],
    queryFn: async () => {
      const res = await fetch("/api/tracker/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const userId = isAdmin ? (selectedUserId === "all" ? undefined : selectedUserId) : user?.id;

  const { data: report, isLoading, isError } = useQuery<UserReport[]>({
    queryKey: ["/api/tracker/stats/report", userId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      if (userId) params.set("userId", String(userId));
      const res = await fetch(`/api/tracker/stats/report?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    enabled: !!startDate && !!endDate,
  });

  const isSingleUser = !isAdmin || selectedUserId !== "all";
  const singleUser = isSingleUser && report?.[0];

  const taskOverviewData = report?.map((u) => ({
    name: u.userName.split(" ")[0],
    fullName: u.userName,
    "Tasks Created": u.tasksCreated,
    "Tasks Assigned": u.tasksAssigned,
  })) ?? [];

  const transitionData = report?.map((u) => ({
    name: u.userName.split(" ")[0],
    fullName: u.userName,
    Open: u.statusTransitions.open,
    "In Testing": u.statusTransitions.in_testing,
    "Needs Fix": u.statusTransitions.needs_fix,
    Confirmed: u.statusTransitions.confirmed,
    Pushed: u.statusTransitions.pushed_to_production,
  })) ?? [];

  const commentsData = report?.map((u) => ({
    name: u.userName.split(" ")[0],
    fullName: u.userName,
    Comments: u.comments,
  })) ?? [];

  const singleTransitionData = singleUser
    ? Object.entries(singleUser.statusTransitions).map(([key, val]) => ({
        status: STATUS_LABELS[key] ?? key,
        count: val,
        fill: STATUS_COLORS[key],
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Activity summary by user and date range</p>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {(users ?? []).map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      )}

      {isError && (
        <Card className="shadow-sm border-destructive/40">
          <CardContent className="pt-6 pb-6 text-center text-destructive">
            Failed to load report. Please try again.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && report && report.length === 0 && (
        <Card className="shadow-sm">
          <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
            No activity found for the selected period.
          </CardContent>
        </Card>
      )}

      {/* Single user view */}
      {!isLoading && !isError && singleUser && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{singleUser.userName}</h2>
            <Badge variant="outline">
              {format(new Date(startDate), "MMM d")} – {format(new Date(endDate), "MMM d, yyyy")}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Tasks Created" value={singleUser.tasksCreated} icon={FolderKanban} color="bg-blue-500/10 text-blue-500" />
            <StatCard label="Tasks Assigned" value={singleUser.tasksAssigned} icon={UserCheck} color="bg-emerald-500/10 text-emerald-500" />
            <StatCard label="Comments" value={singleUser.comments} icon={MessageSquare} color="bg-purple-500/10 text-purple-500" />
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b bg-muted/20">
              <CardTitle className="text-base">Status Transitions</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {singleTransitionData.every((d) => d.count === 0) ? (
                <p className="text-center text-muted-foreground text-sm py-8">No status changes in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={singleTransitionData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {singleTransitionData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* All users view */}
      {!isLoading && !isError && !isSingleUser && report && report.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">All Users</h2>
            <Badge variant="outline">
              {format(new Date(startDate), "MMM d")} – {format(new Date(endDate), "MMM d, yyyy")}
            </Badge>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b bg-muted/20">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderKanban className="w-4 h-4" /> Task Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={taskOverviewData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(val, name, props) => [val, name]} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""} />
                  <Legend />
                  <Bar dataKey="Tasks Created" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Tasks Assigned" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b bg-muted/20">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="w-4 h-4" /> Status Transitions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={transitionData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""} />
                  <Legend />
                  <Bar dataKey="Open" stackId="s" fill={STATUS_COLORS.open} />
                  <Bar dataKey="In Testing" stackId="s" fill={STATUS_COLORS.in_testing} />
                  <Bar dataKey="Needs Fix" stackId="s" fill={STATUS_COLORS.needs_fix} />
                  <Bar dataKey="Confirmed" stackId="s" fill={STATUS_COLORS.confirmed} />
                  <Bar dataKey="Pushed" stackId="s" fill={STATUS_COLORS.pushed_to_production} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b bg-muted/20">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={commentsData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""} />
                  <Bar dataKey="Comments" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
