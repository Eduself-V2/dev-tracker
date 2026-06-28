import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTrackerCreateRequirement,
  useTrackerListUsers,
  useTrackerListProjects,
  getTrackerListRequirementsQueryKey,
  getTrackerListUsersQueryKey,
  getTrackerStatsSummaryQueryKey,
  getTrackerListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowLeft, Check, ChevronsUpDown, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreateRequirementPriority } from "@workspace/api-client-react";
import FileUploadZone from "@/components/FileUploadZone";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"] as const),
  testerIds: z.array(z.number()).optional(),
  assigneeIds: z.array(z.number()).optional(),
  projectId: z.coerce.number().min(1, "Project is required"),
});

type FormValues = z.infer<typeof formSchema>;

async function uploadAttachments(requirementId: number, files: File[]) {
  if (files.length === 0) return;
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const res = await fetch(`/api/tracker/requirements/${requirementId}/attachments`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Upload failed (${res.status})`);
  }
}

export default function RequirementCreate() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: users } = useTrackerListUsers({
    query: { queryKey: getTrackerListUsersQueryKey() },
  });

  const { data: projects } = useTrackerListProjects();

  const createMutation = useTrackerCreateRequirement({
    mutation: {
      onSuccess: async (data) => {
        if (attachmentFiles.length > 0) {
          setUploading(true);
          try {
            await uploadAttachments(data.id, attachmentFiles);
          } catch (uploadErr: any) {
            toast({ title: uploadErr?.message ?? "Requirement created but files failed to upload", variant: "destructive" });
          } finally {
            setUploading(false);
          }
        }
        queryClient.invalidateQueries({ queryKey: getTrackerListRequirementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getTrackerStatsSummaryQueryKey() });
        toast({ title: "Requirement created successfully" });
        setLocation(`/requirements/${data.id}`);
      },
      onError: () => {
        toast({ title: "Failed to create requirement", variant: "destructive" });
      },
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      testerIds: [],
      assigneeIds: [],
      projectId: undefined,
    },
  });

  if (user?.role === "tester") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only developers and admins can create requirements.</p>
        <Button variant="outline" className="mt-6" onClick={() => setLocation("/requirements")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Requirements
        </Button>
      </div>
    );
  }

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority as CreateRequirementPriority,
        testerIds: data.testerIds?.length ? data.testerIds : undefined,
        assigneeIds: data.assigneeIds?.length ? data.assigneeIds : undefined,
        projectId: data.projectId,
      },
    });
  };

  const allUsers = Array.isArray(users) ? users : [];
  const isPending = createMutation.isPending || uploading;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/requirements")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Requirement</h1>
          <p className="text-muted-foreground">Draft a new requirement for the team to process.</p>
        </div>
      </div>

      <Card className="border-border/50 shadow-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="pt-6 space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="E.g., Implement new user dashboard" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide details, acceptance criteria, etc."
                        className="min-h-[120px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString() ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Array.isArray(projects) ? projects : []).map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(user?.role === "admin" || user?.role === "manager") && (
                  <FormField
                    control={form.control}
                    name="assigneeIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign To</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                                {(field.value?.length ?? 0) === 0
                                  ? <span className="text-muted-foreground">Select assignees...</span>
                                  : <span className="flex flex-wrap gap-1">
                                      {field.value!.map((id) => {
                                        const u = allUsers.find((u) => u.id === id);
                                        return <Badge key={id} variant="secondary" className="text-xs">{u?.name ?? id}</Badge>;
                                      })}
                                    </span>}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search users..." />
                              <CommandList>
                                <CommandEmpty>No users found.</CommandEmpty>
                                <CommandGroup>
                                  {allUsers.map((u) => (
                                    <CommandItem
                                      key={u.id}
                                      onSelect={() => {
                                        const current = field.value ?? [];
                                        field.onChange(
                                          current.includes(u.id)
                                            ? current.filter((id) => id !== u.id)
                                            : [...current, u.id],
                                        );
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", field.value?.includes(u.id) ? "opacity-100" : "opacity-0")} />
                                      {u.name} ({u.role})
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(user?.role === "admin" || user?.role === "manager") && (
                  <FormField
                    control={form.control}
                    name="testerIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>QA / Testers (Optional)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                                {(field.value?.length ?? 0) === 0
                                  ? <span className="text-muted-foreground">Select testers...</span>
                                  : <span className="flex flex-wrap gap-1">
                                      {field.value!.map((id) => {
                                        const u = allUsers.find((u) => u.id === id);
                                        return <Badge key={id} variant="secondary" className="text-xs">{u?.name ?? id}</Badge>;
                                      })}
                                    </span>}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search users..." />
                              <CommandList>
                                <CommandEmpty>No users found.</CommandEmpty>
                                <CommandGroup>
                                  {allUsers.map((u) => (
                                    <CommandItem
                                      key={u.id}
                                      onSelect={() => {
                                        const current = field.value ?? [];
                                        field.onChange(
                                          current.includes(u.id)
                                            ? current.filter((id) => id !== u.id)
                                            : [...current, u.id],
                                        );
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", field.value?.includes(u.id) ? "opacity-100" : "opacity-0")} />
                                      {u.name} ({u.role})
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Attachments (Optional)</p>
                <p className="text-xs text-muted-foreground">Attach images, PDFs, Excel or CSV files to this requirement.</p>
                <FileUploadZone files={attachmentFiles} onChange={setAttachmentFiles} />
              </div>
            </CardContent>

            <CardFooter className="bg-muted/30 border-t py-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setLocation("/requirements")}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {uploading ? "Uploading files..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Requirement
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
