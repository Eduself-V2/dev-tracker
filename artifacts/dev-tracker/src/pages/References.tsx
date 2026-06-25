import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTrackerListProjects,
  useTrackerListReferences,
  useTrackerCreateReference,
  useTrackerUpdateReference,
  useTrackerDeleteReference,
  getTrackerListReferencesQueryKey,
  type ProjectReference,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  FolderKanban,
  ShieldAlert,
  Copy,
  Check,
} from "lucide-react";

function ReferenceRow({
  ref: item,
  isAdmin,
  onEdit,
  onDelete,
}: {
  ref: ProjectReference;
  isAdmin: boolean;
  onEdit: (ref: ProjectReference) => void;
  onDelete: (ref: ProjectReference) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/40 group transition-colors">
      <div className="flex-1 min-w-0 grid grid-cols-[1fr_1.5fr] gap-4 items-center">
        <div className="flex items-center gap-2 min-w-0">
          {item.isSensitive && (
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{item.label}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-muted-foreground font-mono truncate">
            {item.isSensitive && !revealed ? "••••••••" : item.value}
          </span>
          {item.isSensitive && (
            <button
              onClick={() => setRevealed((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title={revealed ? "Hide" : "Reveal"}
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} title="Copy value">
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        {isAdmin && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(item)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ProjectReferencesCard({
  project,
  isAdmin,
}: {
  project: { id: number; name: string };
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: refs, isLoading } = useTrackerListReferences(project.id);

  const [addOpen, setAddOpen] = useState(false);
  const [editRef, setEditRef] = useState<ProjectReference | null>(null);
  const [deleteRef, setDeleteRef] = useState<ProjectReference | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formSensitive, setFormSensitive] = useState(false);

  const createMutation = useTrackerCreateReference(project.id, {
    onSuccess: () => {
      toast({ title: "Reference added" });
      setAddOpen(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to add reference", variant: "destructive" }),
  });

  const updateMutation = useTrackerUpdateReference(project.id, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getTrackerListReferencesQueryKey(project.id) });
      toast({ title: "Reference updated" });
      setEditRef(null);
      resetForm();
    },
    onError: () => toast({ title: "Failed to update reference", variant: "destructive" }),
  });

  const deleteMutation = useTrackerDeleteReference(project.id, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getTrackerListReferencesQueryKey(project.id) });
      toast({ title: "Reference deleted" });
      setDeleteRef(null);
    },
    onError: () => toast({ title: "Failed to delete reference", variant: "destructive" }),
  });

  function resetForm() {
    setFormLabel("");
    setFormValue("");
    setFormSensitive(false);
  }

  function openEdit(ref: ProjectReference) {
    setFormLabel(ref.label);
    setFormValue(ref.value);
    setFormSensitive(ref.isSensitive);
    setEditRef(ref);
  }

  const list = Array.isArray(refs) ? refs : [];

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FolderKanban className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-base">{project.name}</CardTitle>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { resetForm(); setAddOpen(true); }}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              No references yet{isAdmin ? " — click Add to create one" : ""}.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {list.map((ref) => (
                <ReferenceRow
                  key={ref.id}
                  ref={ref}
                  isAdmin={isAdmin}
                  onEdit={openEdit}
                  onDelete={setDeleteRef}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formLabel.trim() || !formValue.trim()) return;
              createMutation.mutate({ label: formLabel.trim(), value: formValue.trim(), isSensitive: formSensitive });
            }}
          >
            <DialogHeader>
              <DialogTitle>Add Reference</DialogTitle>
              <DialogDescription>Add a shared reference to <strong>{project.name}</strong>.</DialogDescription>
            </DialogHeader>
            <ReferenceForm
              label={formLabel}
              value={formValue}
              sensitive={formSensitive}
              onLabelChange={setFormLabel}
              onValueChange={setFormValue}
              onSensitiveChange={setFormSensitive}
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!formLabel.trim() || !formValue.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editRef !== null} onOpenChange={() => setEditRef(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editRef || !formLabel.trim() || !formValue.trim()) return;
              updateMutation.mutate({
                refId: editRef.id,
                body: { label: formLabel.trim(), value: formValue.trim(), isSensitive: formSensitive },
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit Reference</DialogTitle>
              <DialogDescription>Update this reference entry.</DialogDescription>
            </DialogHeader>
            <ReferenceForm
              label={formLabel}
              value={formValue}
              sensitive={formSensitive}
              onLabelChange={setFormLabel}
              onValueChange={setFormValue}
              onSensitiveChange={setFormSensitive}
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditRef(null)}>Cancel</Button>
              <Button type="submit" disabled={!formLabel.trim() || !formValue.trim() || updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteRef !== null} onOpenChange={() => setDeleteRef(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (deleteRef) deleteMutation.mutate(deleteRef.id);
            }}
          >
            <DialogHeader>
              <DialogTitle>Delete Reference?</DialogTitle>
              <DialogDescription>
                This will permanently remove <strong>{deleteRef?.label}</strong>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDeleteRef(null)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReferenceForm({
  label,
  value,
  sensitive,
  onLabelChange,
  onValueChange,
  onSensitiveChange,
}: {
  label: string;
  value: string;
  sensitive: boolean;
  onLabelChange: (v: string) => void;
  onValueChange: (v: string) => void;
  onSensitiveChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <Label htmlFor="ref-label">Label</Label>
        <Input
          id="ref-label"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="e.g. Staging URL, Admin Password"
        />
      </div>
      <div>
        <Label htmlFor="ref-value">Value</Label>
        <Input
          id="ref-value"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="e.g. https://staging.example.com"
          type={sensitive ? "password" : "text"}
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id="ref-sensitive"
          checked={sensitive}
          onCheckedChange={onSensitiveChange}
        />
        <Label htmlFor="ref-sensitive" className="cursor-pointer">
          Sensitive (mask value by default)
        </Label>
      </div>
    </div>
  );
}

export default function References() {
  const { user } = useAuth();
  const { data: projects, isLoading } = useTrackerListProjects();

  const isAdmin = user?.role === "admin";
  const list = Array.isArray(projects) ? projects : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">References</h1>
        <p className="text-muted-foreground">
          Shared info per project — URLs, credentials, and other notes.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">No projects yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
              Projects will appear here once created.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((project) => (
            <ProjectReferencesCard key={project.id} project={project} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
