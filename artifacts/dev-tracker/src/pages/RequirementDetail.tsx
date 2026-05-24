import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useTrackerGetRequirement, 
  getTrackerGetRequirementQueryKey,
  useTrackerTransitionRequirement,
  useTrackerAddComment,
  getTrackerListRequirementsQueryKey,
  getTrackerStatsSummaryQueryKey
} from "@workspace/api-client-react";
import type { TransitionRequirementToStatus } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Clock,
  MessageSquare,
  ArrowRight,
  Play,
  User,
  Activity,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  FolderKanban,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

type Transition = {
  status: TransitionRequirementToStatus;
  label: string;
  icon: any;
  variant: "default" | "destructive" | "secondary";
};

const getAllowedTransitions = (currentStatus: string, role: string): Transition[] => {
  if (role === 'admin') {
    const all: Transition[] = [
      { status: 'open', label: 'Move to Open', icon: Activity, variant: 'secondary' },
      { status: 'in_testing', label: 'Move to In Testing', icon: Play, variant: 'default' },
      { status: 'needs_fix', label: 'Move to Needs Fix', icon: AlertCircle, variant: 'destructive' },
      { status: 'confirmed', label: 'Move to Confirmed', icon: CheckCircle2, variant: 'default' },
      { status: 'pushed_to_production', label: 'Push to Production', icon: ArrowRight, variant: 'default' },
    ];
    return all.filter(t => t.status !== currentStatus);
  }

  if (role === 'developer') {
    if (currentStatus === 'open' || currentStatus === 'needs_fix') {
      return [{ status: 'in_testing', label: 'Submit for Testing', icon: Play, variant: 'default' }];
    }
    if (currentStatus === 'confirmed') {
      return [{ status: 'pushed_to_production', label: 'Push to Production', icon: ArrowRight, variant: 'default' }];
    }
    return [];
  }

  if (role === 'tester') {
    if (currentStatus === 'in_testing') {
      return [
        { status: 'confirmed', label: 'Confirm Fixes', icon: CheckCircle2, variant: 'default' },
        { status: 'needs_fix', label: 'Needs Fix', icon: AlertCircle, variant: 'destructive' },
      ];
    }
    return [];
  }

  return [];
};

export default function RequirementDetail() {
  const { id } = useParams();
  const reqId = parseInt(id || "");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useTrackerGetRequirement(reqId, {
    query: {
      enabled: !isNaN(reqId),
      queryKey: getTrackerGetRequirementQueryKey(reqId)
    }
  });

  const [commentBody, setCommentBody] = useState("");
  const [transitionNote, setTransitionNote] = useState("");

  const commentMutation = useTrackerAddComment({
    mutation: {
      onSuccess: () => {
        setCommentBody("");
        queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
      },
      onError: () => toast({ title: "Failed to post comment", variant: "destructive" })
    }
  });

  const transitionMutation = useTrackerTransitionRequirement({
    mutation: {
      onSuccess: () => {
        setTransitionNote("");
        queryClient.invalidateQueries({ queryKey: getTrackerGetRequirementQueryKey(reqId) });
        queryClient.invalidateQueries({ queryKey: getTrackerListRequirementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getTrackerStatsSummaryQueryKey() });
        toast({ title: "Status updated successfully" });
      },
      onError: () => toast({ title: "Failed to update status", variant: "destructive" })
    }
  });

  if (isError || isNaN(reqId)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Requirement Not Found</h2>
        <p className="text-muted-foreground mt-2">The requirement you're looking for doesn't exist or you don't have access.</p>
        <Link href="/requirements" className="mt-6">
          <Button variant="outline">Back to Requirements</Button>
        </Link>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const { requirement, events, comments } = data;
  const allowedTransitions = getAllowedTransitions(requirement.status, user?.role || "");

  const handleTransition = (status: TransitionRequirementToStatus) => {
    transitionMutation.mutate({
      id: reqId,
      data: {
        toStatus: status,
        note: transitionNote || undefined
      }
    });
  };

  const handlePostComment = () => {
    if (!commentBody.trim()) return;
    commentMutation.mutate({
      id: reqId,
      data: { body: commentBody }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/requirements">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Badge variant={requirement.priority === 'high' ? 'destructive' : requirement.priority === 'medium' ? 'default' : 'secondary'}>
              {requirement.priority} priority
            </Badge>
            <Badge variant="outline" className="capitalize px-3 py-1 bg-background shadow-sm">
              {requirement.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
        {/* We would add an edit button here if there was an edit page, but we're keeping it simple for now */}
      </div>

      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight leading-tight">{requirement.title}</h1>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground mt-2">
          <span className="flex items-center gap-2">
            <Avatar className="w-5 h-5"><AvatarFallback className="text-[10px]">{requirement.developerName.charAt(0)}</AvatarFallback></Avatar>
            Dev: <span className="font-medium text-foreground">{requirement.developerName}</span>
          </span>
          <span className="flex items-center gap-2">
            <Avatar className="w-5 h-5"><AvatarFallback className="text-[10px]">{requirement.testerName ? requirement.testerName.charAt(0) : '?'}</AvatarFallback></Avatar>
            QA: <span className="font-medium text-foreground">{requirement.testerName || "Unassigned"}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Activity className="w-4 h-4" />
            {requirement.testCycles} cycles
          </span>
          <span className="flex items-center gap-1.5">
            <Link href={`/requirements?project=${requirement.projectId}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <FolderKanban className="w-4 h-4" />
              {requirement.projectName}
            </Link>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            Created {format(new Date(requirement.createdAt), "MMM d, yyyy")}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {requirement.description ? (
                <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{requirement.description}</p>
              ) : (
                <p className="text-muted-foreground italic">No description provided.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Discussion
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {comments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>No comments yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {comments.map(comment => (
                    <div key={comment.id} className="flex gap-4">
                      <Avatar className="w-10 h-10 border shadow-sm shrink-0">
                        <AvatarFallback className="bg-primary/5 text-primary font-medium">{comment.authorName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{comment.authorName}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{comment.authorRole}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="bg-muted/40 p-3 rounded-lg rounded-tl-none border border-border/50 text-sm">
                          <p className="whitespace-pre-wrap">{comment.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator />
              
              <div className="flex gap-4">
                <Avatar className="w-10 h-10 border shadow-sm shrink-0 hidden sm:block">
                  <AvatarFallback className="bg-primary text-primary-foreground font-medium">{user?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <Textarea 
                    placeholder="Add a comment..." 
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    className="min-h-[100px] resize-y bg-background"
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={handlePostComment} 
                      disabled={!commentBody.trim() || commentMutation.isPending}
                    >
                      {commentMutation.isPending ? "Posting..." : "Post Comment"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {allowedTransitions.length > 0 && (
            <Card className="border-primary/20 shadow-md bg-primary/5 overflow-hidden">
              <CardHeader className="pb-3 border-b bg-background/50">
                <CardTitle className="text-lg">Update Status</CardTitle>
                <CardDescription>Move this requirement to the next stage.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Textarea 
                  placeholder="Optional note for this transition..." 
                  value={transitionNote}
                  onChange={(e) => setTransitionNote(e.target.value)}
                  className="text-sm min-h-[80px] bg-background"
                />
                <div className="space-y-2">
                  {allowedTransitions.map(t => (
                    <Button 
                      key={t.status} 
                      variant={t.variant} 
                      className="w-full justify-start"
                      onClick={() => handleTransition(t.status)}
                      disabled={transitionMutation.isPending}
                    >
                      <t.icon className="w-4 h-4 mr-2" />
                      {t.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {events.map((event, i) => (
                  <div key={event.id} className="relative flex items-start gap-4">
                    <div className="absolute left-0 w-10 h-10 flex items-center justify-center z-10 bg-background rounded-full border shadow-sm shrink-0 text-muted-foreground">
                      {event.kind === 'created' && <PlusCircle className="w-4 h-4" />}
                      {event.kind === 'transitioned' && <ArrowRight className="w-4 h-4" />}
                      {event.kind === 'comment' && <MessageSquare className="w-4 h-4" />}
                      {event.kind === 'assigned' && <User className="w-4 h-4" />}
                    </div>
                    <div className="ml-14 flex-1 pb-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {event.actorName} <span className="font-normal text-muted-foreground">{event.kind === 'created' ? 'created this' : event.kind === 'transitioned' ? 'changed status' : event.kind === 'assigned' ? 'assigned tester' : 'commented'}</span>
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {event.kind === 'transitioned' && event.fromStatus && event.toStatus && (
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="px-1.5 py-0 h-5 font-normal capitalize bg-muted/50">{event.fromStatus.replace(/_/g, ' ')}</Badge>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <Badge variant="secondary" className="px-1.5 py-0 h-5 font-normal capitalize">{event.toStatus.replace(/_/g, ' ')}</Badge>
                        </div>
                      )}
                      
                      {event.note && (
                        <div className="mt-2 bg-muted/30 border border-border/50 rounded-md p-2.5 text-xs text-muted-foreground italic">
                          "{event.note}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
