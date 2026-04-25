import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useTrackerCreateRequirement, 
  useTrackerListUsers, 
  getTrackerListRequirementsQueryKey,
  getTrackerListUsersQueryKey,
  getTrackerStatsSummaryQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ArrowLeft, Loader2, Save } from "lucide-react";
import type { CreateRequirementPriority } from "@workspace/api-client-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"] as const),
  testerId: z.coerce.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function RequirementCreate() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users } = useTrackerListUsers({
    query: {
      queryKey: getTrackerListUsersQueryKey(),
      enabled: user?.role === "admin"
    }
  });

  const createMutation = useTrackerCreateRequirement({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getTrackerListRequirementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getTrackerStatsSummaryQueryKey() });
        toast({ title: "Requirement created successfully" });
        setLocation(`/requirements/${data.id}`);
      },
      onError: () => {
        toast({ title: "Failed to create requirement", variant: "destructive" });
      }
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      testerId: null,
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
        testerId: data.testerId || undefined,
      } 
    });
  };

  const testers = users?.filter(u => u.role === "tester") || [];

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

                {user?.role === "admin" && (
                  <FormField
                    control={form.control}
                    name="testerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign Tester (Optional)</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                          value={field.value?.toString() || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a tester" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {testers.map(tester => (
                              <SelectItem key={tester.id} value={tester.id.toString()}>{tester.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t py-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setLocation("/requirements")}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
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
