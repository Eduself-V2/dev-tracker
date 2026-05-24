import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTrackerListProjects,
  useTrackerCreateProject,
  useTrackerUpdateProject,
  useTrackerDeleteProject,
  getTrackerListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FolderKanban,
  PlusCircle,
  Pencil,
  Trash2,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";

export default function Projects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: projects, isLoading } = useTrackerListProjects();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<{ id: number; name: string; description?: string | null } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const createMutation = useTrackerCreateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getTrackerListProjectsQueryKey() });
        toast({ title: "Project created" });
        setCreateOpen(false);
        setFormName("");
        setFormDescription("");
      },
      onError: () => toast({ title: "Failed to create project", variant: "destructive" }),
    }
  });

  const updateMutation = useTrackerUpdateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getTrackerListProjectsQueryKey() });
        toast({ title: "Project updated" });
        setEditOpen(false);
        setEditProject(null);
        setFormName("");
        setFormDescription("");
      },
      onError: () => toast({ title: "Failed to update project", variant: "destructive" }),
    }
  });

  const deleteMutation = useTrackerDeleteProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getTrackerListProjectsQueryKey() });
        toast({ title: "Project deleted" });
        setDeleteId(null);
      },
      onError: (err: any) => {
        toast({ title: err?.response?.data?.error || "Failed to delete project", variant: "destructive" });
        setDeleteId(null);
      }
    }
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only admins can manage projects.</p>
        <Button variant="outline" className="mt-6" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage the projects that group your requirements.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)
        ) : projects?.length === 0 ? (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FolderKanban className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold">No projects yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-2">
                Create a project to start grouping your requirements.
              </p>
            </CardContent>
          </Card>
        ) : (
          projects?.map((project) => (
            <Card key={project.id} className="group hover:border-primary/30 transition-all shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FolderKanban className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg leading-tight">{project.name}</CardTitle>
                      <CardDescription className="text-xs">
                        Created {new Date(project.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditProject(project);
                        setFormName(project.name);
                        setFormDescription(project.description || "");
                        setEditOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(project.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {project.description && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-3">{project.description}</p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formName.trim()) return;
              createMutation.mutate({ data: { name: formName.trim(), description: formDescription || undefined } });
            }}
          >
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>Add a new project to organize requirements.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Project name" />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={!formName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formName.trim() || !editProject) return;
              updateMutation.mutate({
                id: editProject.id,
                data: { name: formName.trim(), description: formDescription || undefined },
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>Update project details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Project name" />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={!formName.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (deleteId !== null) deleteMutation.mutate({ id: deleteId });
            }}
          >
            <DialogHeader>
              <DialogTitle>Delete Project?</DialogTitle>
              <DialogDescription>
                This will permanently remove the project. If it has requirements assigned, deletion will be blocked.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
