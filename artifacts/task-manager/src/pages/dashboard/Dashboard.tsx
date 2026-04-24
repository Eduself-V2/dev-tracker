import { 
  useGetStatsSummary, 
  useGetRecentActivity,
  getGetStatsSummaryQueryKey,
  getGetRecentActivityQueryKey
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ListTodo,
  TrendingUp,
  Activity
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStatsSummary({
    query: { queryKey: getGetStatsSummaryQueryKey() }
  });

  const { data: recentTasks, isLoading: recentLoading } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() }
  });

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-3xl font-serif font-semibold text-foreground mt-2">{value}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">A high-level view of your productivity.</p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard 
            title="Total Tasks" 
            value={stats.total} 
            icon={ListTodo} 
            colorClass="bg-secondary text-foreground"
          />
          <StatCard 
            title="Completed" 
            value={stats.completed} 
            icon={CheckCircle2} 
            colorClass="bg-accent/15 text-accent"
            subtitle={`${Math.round(stats.completionRate * 100)}% completion rate`}
          />
          <StatCard 
            title="Active" 
            value={stats.active} 
            icon={Clock} 
            colorClass="bg-primary/15 text-primary"
          />
          <StatCard 
            title="Overdue" 
            value={stats.overdue} 
            icon={AlertCircle} 
            colorClass="bg-destructive/15 text-destructive"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-secondary/30">
              <h2 className="font-serif font-medium text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                Recent Activity
              </h2>
            </div>
            
            <div className="p-0">
              {recentLoading ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentTasks?.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-muted-foreground">No recent activity to show.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentTasks?.map((task) => (
                    <div key={task.id} className="p-5 flex items-start gap-4 hover:bg-secondary/20 transition-colors">
                      <div className={`mt-0.5 rounded-full p-1.5 ${task.completed ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'}`}>
                        {task.completed ? <CheckCircle2 className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className={`font-medium ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {task.completed ? 'Completed' : 'Updated'} {format(new Date(task.updatedAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-border bg-secondary/30">
              <h2 className="font-serif font-medium text-lg">Priority Breakdown</h2>
            </div>
            <div className="p-6">
              {statsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : stats ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-destructive flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-destructive"></span> High
                      </span>
                      <span className="text-muted-foreground">{stats.byPriority.high} tasks</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-destructive h-2 rounded-full" style={{ width: `${stats.total ? (stats.byPriority.high / stats.total) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-primary flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary"></span> Medium
                      </span>
                      <span className="text-muted-foreground">{stats.byPriority.medium} tasks</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${stats.total ? (stats.byPriority.medium / stats.total) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-accent flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent"></span> Low
                      </span>
                      <span className="text-muted-foreground">{stats.byPriority.low} tasks</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-accent h-2 rounded-full" style={{ width: `${stats.total ? (stats.byPriority.low / stats.total) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
