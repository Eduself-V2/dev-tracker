import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTrackerGetRequirement,
  useTrackerUpdateRequirement,
  useTrackerListUsers,
  useTrackerListProjects,
  getTrackerListRequirementsQueryKey,
  getTrackerGetRequirementQueryKey,
  getTrackerListUsersQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Loader2, Save } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"] as const),
  testerId: z.coerce.number().optional().nullable(),
  assigneeId: z.coerce.number().optional().nullable(),
  projectId: z.coerce.number().min(1, "Project is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function RequirementEdit() {
  const { id } = useParams();
  const reqId = parseInt(id || "");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useTrackerGetRequirement(reqId, {
    query: {
      enabled: !isNaN(reqId),
      queryKey: getTrackerGetRequirementQueryKey(reqId),
    },
  });

  const { data: users } = useTrackerListUsers({
    query: {
      queryKey: getTrackerListUsersQueryKey(),
    },
  });

  const { data: projects } = useTrackerListProjects();

  const updateMutation = useTrackerUpdateRequirement({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getTrackerListRequirementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
        toast({ title: "Requirement updated successfully" });
        setLocation(`/requirements/${updated.id}`);
      },
      onError: () => {
        toast({ title: "Failed to update requirement", variant: "destructive" });
      },
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      testerId: null,
      assigneeId: null,
      projectId: undefined,
    },
  });

  // Pre-populate form once data loads
  useEffect(() => {
    if (data?.requirement) {
      const r = data.requirement;
      form.reset({
        title: r.title,
        description: r.description ?? "",
        priority: r.priority as "low" | "medium" | "high",
        testerId: r.testerId ?? null,
        assigneeId: r.assigneeId ?? null,
        projectId: r.projectId,
      });
    }
  }, [data]);

  const canEdit =
    user?.role === "admin" ||
    (user?.role === "developer" && data?.requirement?.developerId === user?.id);

  if (isError || isNaN(reqId)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Requirement Not Found</h2>
        <Button variant="outline" className="mt-6" onClick={() => setLocation("/requirements")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Requirements
        </Button>
      </div>
    );
  }

  if (!canEdit && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only the owning developer or an admin can edit this requirement.</p>
        <Button variant="outline" className="mt-6" onClick={() => setLocation(`/requirements/${reqId}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Requirement
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate({
      id: reqId,
      data: {
        title: values.title,
        description: values.description,
        priority: values.priority,
        testerId: values.testerId ?? null,
        assigneeId: values.assigneeId ?? null,
        projectId: values.projectId,
      },
    });
  };

  const allUsers = Array.isArray(users) ? users : [];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/requirements/${reqId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Requirement</h1>
          <p className="text-muted-foreground">Update the details of this requirement.</p>
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
                      <Select
                        onValueChange={(val) => field.onChange(parseInt(val))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Array.isArray(projects) ? projects : []).map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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

                <FormField
                  control={form.control}
                  name="assigneeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))}
                        value={field.value?.toString() ?? "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {allUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id.toString()}>
                              {u.name} ({u.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="testerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>QA / Tester (Optional)</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))}
                        value={field.value?.toString() ?? "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select QA person" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {allUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id.toString()}>
                              {u.name} ({u.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>

            <CardFooter className="bg-muted/30 border-t py-4 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation(`/requirements/${reqId}`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
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
