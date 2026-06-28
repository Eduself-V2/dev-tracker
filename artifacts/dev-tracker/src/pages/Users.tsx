import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useTrackerListUsers, 
  useTrackerCreateUser, 
  useTrackerUpdateUser, 
  useTrackerDeleteUser,
  getTrackerListUsersQueryKey
} from "@workspace/api-client-react";
import type { CreateTrackerUserRole } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AlertCircle, Edit, Plus, Trash2, Shield, User, Smartphone, Mail, Key } from "lucide-react";

const userSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Invalid email address"),
  mobile: z.string().optional().nullable(),
  username: z.string().min(3, "Username must be at least 3 characters").max(60),
  password: z.string().optional(),
  role: z.enum(["admin", "manager", "developer", "tester"] as const),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function Users() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);

  const { data: users, isLoading } = useTrackerListUsers({
    query: {
      queryKey: getTrackerListUsersQueryKey(),
      enabled: currentUser?.role === "admin",
    }
  });

  const createMutation = useTrackerCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getTrackerListUsersQueryKey() });
        setIsCreateOpen(false);
        form.reset();
        toast({ title: "User created successfully" });
      },
      onError: (err: any) => {
        if (err?.status === 409) {
          toast({ title: "Username or email already exists", variant: "destructive" });
        } else {
          toast({ title: "Failed to create user", variant: "destructive" });
        }
      }
    }
  });

  const updateMutation = useTrackerUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getTrackerListUsersQueryKey() });
        setEditUserId(null);
        form.reset();
        toast({ title: "User updated successfully" });
      },
      onError: (err: any) => {
        if (err?.status === 409) {
          toast({ title: "Email already exists", variant: "destructive" });
        } else {
          toast({ title: "Failed to update user", variant: "destructive" });
        }
      }
    }
  });

  const deleteMutation = useTrackerDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getTrackerListUsersQueryKey() });
        toast({ title: "User deleted successfully" });
      },
      onError: () => {
        toast({ title: "Failed to delete user", variant: "destructive" });
      }
    }
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      username: "",
      password: "",
      role: "developer",
    },
  });

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Shield className="h-16 w-16 text-destructive mb-6" />
        <h2 className="text-3xl font-bold tracking-tight">Access Denied</h2>
        <p className="text-muted-foreground mt-3 max-w-md">
          Only administrators have access to user management. Please return to the dashboard.
        </p>
      </div>
    );
  }

  const onSubmit = (data: UserFormValues) => {
    if (editUserId) {
      updateMutation.mutate({
        id: editUserId,
        data: {
          name: data.name,
          email: data.email,
          mobile: data.mobile || null,
          role: data.role as CreateTrackerUserRole,
          ...(data.password ? { password: data.password } : {})
        }
      });
    } else {
      if (!data.password) {
        form.setError("password", { message: "Password is required for new users" });
        return;
      }
      createMutation.mutate({
        data: {
          name: data.name,
          email: data.email,
          mobile: data.mobile || null,
          username: data.username,
          password: data.password,
          role: data.role as CreateTrackerUserRole,
        }
      });
    }
  };

  const handleEdit = (user: any) => {
    setEditUserId(user.id);
    form.reset({
      name: user.name,
      email: user.email,
      mobile: user.mobile || "",
      username: user.username,
      password: "",
      role: user.role,
    });
  };

  const handleOpenCreate = () => {
    setEditUserId(null);
    form.reset({
      name: "",
      email: "",
      mobile: "",
      username: "",
      password: "",
      role: "developer",
    });
    setIsCreateOpen(true);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin": return <Badge className="bg-primary hover:bg-primary/90">{role}</Badge>;
      case "manager": return <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20">{role}</Badge>;
      case "developer": return <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20">{role}</Badge>;
      case "tester": return <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20">{role}</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Directory</h1>
          <p className="text-muted-foreground">Manage user access, roles, and profiles.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Team Member</DialogTitle>
              <DialogDescription>
                Create a new user account and assign their role in the squad.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="John Doe" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="johndoe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="john@example.com" type="email" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile (Optional)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Smartphone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="+1 234 567 890" {...field} value={field.value || ""} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" type="password" placeholder="••••••••" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Administrator</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="tester">QA Tester</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : users?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users?.map((u) => (
                <TableRow key={u.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">@{u.username}</TableCell>
                  <TableCell>{getRoleBadge(u.role)}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col text-muted-foreground">
                      <span>{u.email}</span>
                      {u.mobile && <span className="text-xs">{u.mobile}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(u.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog open={editUserId === u.id} onOpenChange={(open) => !open && setEditUserId(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(u)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>Edit Team Member</DialogTitle>
                            <DialogDescription>Update profile details for {u.name}.</DialogDescription>
                          </DialogHeader>
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="username" render={({ field }) => (
                                  <FormItem><FormLabel>Username</FormLabel><FormControl><Input {...field} disabled className="bg-muted" /></FormControl><FormMessage /></FormItem>
                                )} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="email" render={({ field }) => (
                                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="mobile" render={({ field }) => (
                                  <FormItem><FormLabel>Mobile (Optional)</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                                )} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="password" render={({ field }) => (
                                  <FormItem><FormLabel>Password <span className="text-muted-foreground font-normal">(leave blank to keep)</span></FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="role" render={({ field }) => (
                                  <FormItem><FormLabel>System Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl><SelectContent><SelectItem value="admin">Administrator</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="developer">Developer</SelectItem><SelectItem value="tester">QA Tester</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                )} />
                              </div>
                              <DialogFooter className="pt-4">
                                <Button type="button" variant="outline" onClick={() => setEditUserId(null)}>Cancel</Button>
                                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save Changes"}</Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={currentUser.id === u.id || u.role === "admin"}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove <strong>{u.name}</strong> from the system? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteMutation.mutate({ id: u.id })}
                            >
                              Yes, remove member
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
