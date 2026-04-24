import { useState, useMemo } from "react";
import { 
  useListTasks, 
  useCreateTask, 
  useUpdateTask, 
  useDeleteTask, 
  useToggleTask,
  getListTasksQueryKey,
  getGetStatsSummaryQueryKey,
  getGetRecentActivityQueryKey,
  ListTasksStatus,
  ListTasksPriority
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Plus, MoreVertical, Search, Filter, Trash2, Edit3, Loader2 } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

// --- TaskForm Component ---

function TaskForm({ 
  initialData, 
  onSave, 
  onCancel,
  isPending 
}: { 
  initialData?: any, 
  onSave: (data: any) => void, 
  onCancel: () => void,
  isPending: boolean
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [priority, setPriority] = useState(initialData?.priority || "medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(
    initialData?.dueDate ? new Date(initialData.dueDate) : undefined
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrors({ title: "Title is required" });
      return;
    }
    
    onSave({
      title,
      description: description || null,
      priority,
      dueDate: dueDate ? dueDate.toISOString() : null
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="title">Task Title</Label>
        <Input 
          id="title" 
          value={title} 
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors({});
          }}
          placeholder="What needs to be done?"
          autoFocus
          className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea 
          id="description" 
          value={description} 
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add some details..."
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Due Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal ${!dueDate && "text-muted-foreground"}`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={setDueDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Task
        </Button>
      </DialogFooter>
    </form>
  );
}

// --- Main Tasks Component ---

export default function Tasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // State
  const [status, setStatus] = useState<ListTasksStatus | "all">("all");
  const [priority, setPriority] = useState<ListTasksPriority | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [deleteTaskObj, setDeleteTaskObj] = useState<any>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Queries
  const queryParams = useMemo(() => {
    const params: any = {};
    if (status !== "all") params.status = status;
    if (priority !== "all") params.priority = priority;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [status, priority, debouncedSearch]);

  const { data: tasks, isLoading, isError } = useListTasks(queryParams, {
    query: {
      queryKey: getListTasksQueryKey(queryParams)
    }
  });

  // Mutations
  const createMutation = useCreateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
        setIsCreateOpen(false);
        toast({ title: "Task created successfully" });
      },
      onError: () => toast({ title: "Failed to create task", variant: "destructive" })
    }
  });

  const updateMutation = useUpdateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
        setEditTask(null);
        toast({ title: "Task updated successfully" });
      },
      onError: () => toast({ title: "Failed to update task", variant: "destructive" })
    }
  });

  const deleteMutation = useDeleteTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
        setDeleteTaskObj(null);
        toast({ title: "Task deleted" });
      },
      onError: () => toast({ title: "Failed to delete task", variant: "destructive" })
    }
  });

  const toggleMutation = useToggleTask({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
      },
      onError: () => toast({ title: "Failed to update status", variant: "destructive" })
    }
  });

  // Priority color map
  const priorityColors = {
    low: "bg-accent/15 text-accent border-accent/20",
    medium: "bg-primary/15 text-primary border-primary/20",
    high: "bg-destructive/15 text-destructive border-destructive/20"
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">Your Tasks</h1>
          <p className="text-muted-foreground mt-1">Focus on what's important today.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="rounded-full shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Add Task
        </Button>
      </div>

      <div className="bg-card border border-border p-4 rounded-xl shadow-sm mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search tasks..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger className="w-[130px] bg-background">
              <div className="flex items-center gap-2">
                <Filter className="h-3 w-3 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
            <SelectTrigger className="w-[130px] bg-background">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border p-5 rounded-xl">
              <div className="flex gap-4">
                <Skeleton className="h-6 w-6 rounded-md" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
          ))
        ) : isError ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <p className="text-destructive font-medium">Failed to load tasks</p>
            <Button variant="outline" className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() })}>
              Try again
            </Button>
          </div>
        ) : tasks?.length === 0 ? (
          <div className="text-center py-16 px-4 bg-card rounded-xl border border-border shadow-sm">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-serif font-medium text-foreground">
              {search || status !== "all" || priority !== "all" 
                ? "No tasks match your filters" 
                : "Your list is clear"}
            </h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              {search || status !== "all" || priority !== "all" 
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Take a deep breath and enjoy the empty space. Or, add a new task to get started."}
            </p>
            {(search || status !== "all" || priority !== "all") && (
              <Button 
                variant="outline" 
                className="mt-6"
                onClick={() => { setSearch(""); setStatus("all"); setPriority("all"); }}
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          tasks?.map((task) => (
            <div 
              key={task.id} 
              className={`group flex items-start gap-4 p-5 rounded-xl border transition-all duration-200 ${
                task.completed 
                  ? "bg-secondary/40 border-border/50" 
                  : "bg-card border-border hover:shadow-md hover:border-primary/20"
              }`}
            >
              <Checkbox 
                checked={task.completed} 
                onCheckedChange={() => toggleMutation.mutate({ id: task.id })}
                className={`mt-1 h-6 w-6 rounded-md transition-all ${
                  task.completed ? "data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground border-accent/50" : ""
                }`}
                disabled={toggleMutation.isPending}
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className={`font-medium text-[1.05rem] truncate transition-colors ${
                    task.completed ? "line-through text-muted-foreground" : "text-foreground"
                  }`}>
                    {task.title}
                  </h3>
                  {!task.completed && (
                    <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0 h-5 ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
                      {task.priority}
                    </Badge>
                  )}
                </div>
                
                {task.description && (
                  <p className={`text-sm mb-3 line-clamp-2 ${task.completed ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
                    {task.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {task.dueDate && (
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span className={new Date(task.dueDate) < new Date() && !task.completed ? "text-destructive font-medium" : ""}>
                        {format(new Date(task.dueDate), "MMM d")}
                      </span>
                    </span>
                  )}
                  <span>Created {format(new Date(task.createdAt), "MMM d")}</span>
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 -mr-2">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditTask(task)}>
                    <Edit3 className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={() => setDeleteTaskObj(task)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">New Task</DialogTitle>
            <DialogDescription>Add a new task to your list.</DialogDescription>
          </DialogHeader>
          <TaskForm 
            onSave={(data) => createMutation.mutate({ data })} 
            onCancel={() => setIsCreateOpen(false)}
            isPending={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Edit Task</DialogTitle>
          </DialogHeader>
          {editTask && (
            <TaskForm 
              initialData={editTask}
              onSave={(data) => updateMutation.mutate({ id: editTask.id, data })} 
              onCancel={() => setEditTask(null)}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={!!deleteTaskObj} onOpenChange={(open) => !open && setDeleteTaskObj(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTaskObj?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate({ id: deleteTaskObj.id });
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Temporary CheckCircle2 icon since we didn't import it at the top
function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
